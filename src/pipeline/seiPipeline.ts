import { generateSeiFromPoseJson } from '../utils/seiUtils';

export async function generateSei(result: any, fileName: string, setSeiPng: any, setSeiSavedPath: any, setGenerating: any, setError: any) {
  console.log('[Pipeline] Step: Generate SEI - started');
  try {
    setError(null);
    setGenerating(true);
    setSeiPng(null);
    setSeiSavedPath(null);
    if (!result?.outputFile) {
      setGenerating(false);
      console.log('[Pipeline] Step: Generate SEI - no keypoints JSON');
      throw new Error('Run analysis first to generate keypoints JSON.');
    }
    const baseName = (fileName?.split('.')[0]) || 'video';
    console.log('[Pipeline] Step: Generate SEI - running generateSeiFromPoseJson');
    const { png, path } = await generateSeiFromPoseJson(result.outputFile, baseName, { size: 224 });
    setSeiPng(png);
    setSeiSavedPath(path);
    setGenerating(false);
    console.log('[Pipeline] Step: Generate SEI - completed');
  } catch (e: any) {
    setGenerating(false);
    setError(e?.message || String(e));
    console.log('[Pipeline] Step: Generate SEI - error:', e?.message || String(e));
  }
}
