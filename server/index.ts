import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { MeetingOrchestrator, type CodexExecResult, type RunTurnRequest } from './orchestrator';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ヘルスチェックエンドポイント
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', message: 'Turtle Brain Backend is running' });
});

/**
 * Codex CLIを非対話モード (exec) で実行するヘルパー関数。
 * `-o` フラグで一時ファイルにクリーンな応答のみを書き出し、それを読み取る。
 * これによりstdoutに混入するメタデータ（セッション情報、トークン数等）を回避する。
 */
function runCodexExec(model: string, prompt: string, sessionId?: string): Promise<CodexExecResult> {
  return new Promise((resolve, reject) => {
    // 出力用の一時ファイルを生成
    const tmpOutFile = path.join(os.tmpdir(), `codex-out-${Date.now()}.txt`);

    const isWindows = process.platform === 'win32';
    const codexEntryPath = path.join(process.env.APPDATA || '', 'npm', 'node_modules', '@openai', 'codex', 'bin', 'codex.js');
    const codexCommand = isWindows ? process.execPath : 'npx';
    const baseArgs = sessionId
      ? ['exec', '--json', 'resume', sessionId, '-m', model, '-o', tmpOutFile, prompt]
      : ['exec', '--json', '-m', model, '-o', tmpOutFile, prompt];
    const args = isWindows ? [codexEntryPath, ...baseArgs] : ['codex', ...baseArgs];

    console.log(`[Codex] Running command (prompt length: ${prompt.length}, output: ${tmpOutFile})...`);

    const child = spawn(codexCommand, args, {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    child.on('close', (code: number | null) => {
      if (code !== 0) {
        console.error(`[Codex] Process exited with code ${code}`);
        console.error(`[Codex] stderr: ${stderr}`);
        // 一時ファイルの片付け
        try { fs.unlinkSync(tmpOutFile); } catch {}
        reject(new Error(`Codex exited with code ${code}. stderr: ${stderr}`));
        return;
      }

      // -o フラグで保存されたファイルからクリーンな応答を読み取る
      try {
        const response = fs.readFileSync(tmpOutFile, 'utf-8').trim();
        const sessionIdFromStdout = stdout
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean)
          .map((line) => {
            try {
              return JSON.parse(line);
            } catch {
              return null;
            }
          })
          .find((entry) => entry?.type === 'thread.started')?.thread_id ?? null;
        console.log(`[Codex] Response loaded from file (${response.length} chars)`);
        
        // 一時ファイルの片付け
        try { fs.unlinkSync(tmpOutFile); } catch {}
        
        if (!response) {
          reject(new Error('Codex returned empty response'));
          return;
        }
        
        resolve({ response, sessionId: sessionIdFromStdout ?? sessionId ?? null });
      } catch (readErr) {
        console.error(`[Codex] Failed to read output file:`, readErr);
        // ファイルが無い場合は一時ファイルの片付け
        try { fs.unlinkSync(tmpOutFile); } catch {}
        reject(new Error(`Failed to read Codex output file: ${readErr}`));
      }
    });

    child.on('error', (err: Error) => {
      try { fs.unlinkSync(tmpOutFile); } catch {}
      reject(err);
    });
  });
}

const orchestrator = new MeetingOrchestrator(runCodexExec);

// Codex CLI呼び出しエンドポイント
app.post('/api/agent/interact', async (req, res) => {
  try {
    const { prompt, model = 'gpt-5.4', sessionId } = req.body;
    console.log(`[API] Received prompt for ${model}. Executing Codex CLI...`);
    
    const result = await runCodexExec(model, prompt, sessionId);

    console.log(`[API] Response (first 100 chars): ${result.response.substring(0, 100)}`);

    res.json({ 
      success: true, 
      response: result.response,
      sessionId: result.sessionId
    });
  } catch (error) {
    console.error('[API] Error during agent interaction:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error', details: String(error) });
  }
});

app.post('/api/orchestrator/run-turn', async (req, res) => {
  try {
    const payload = req.body as RunTurnRequest;
    const result = await orchestrator.runTurn(payload);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('[API] Error during orchestration:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error', details: String(error) });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
