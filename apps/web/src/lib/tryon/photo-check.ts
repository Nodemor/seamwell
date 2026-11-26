"use client";
/**
 * Free in-browser photo check (MediaPipe Pose). Runs BEFORE any GPU time is spent.
 * Blocking problems are the ones that make the model guess wrong (tested: with the face cut off and
 * hands in pockets, the model redrew the person from behind).
 */
const MP_VERSION = "0.10.14";
const WASM = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}/wasm`;
const MODEL = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

export interface PhotoCheckResult {
  blocking: string[];
  tips: string[];
}

type Landmarker = { detect: (img: ImageBitmap) => { landmarks?: { x: number; y: number; visibility?: number }[][] } };
let landmarker: Promise<Landmarker> | null = null;

async function getLandmarker(): Promise<Landmarker> {
  landmarker ??= (async () => {
    const { FilesetResolver, PoseLandmarker } = await import("@mediapipe/tasks-vision");
    // MediaPipe's WASM keeps its own reference to console.error (taken while it loads) and prints
    // "INFO: Created TensorFlow Lite XNNPACK delegate" through it. Hand it a filtered copy during loading only.
    const error = console.error;
    console.error = (...a: unknown[]) => void (typeof a[0] === "string" && a[0].startsWith("INFO:") ? 0 : error(...a));
    try {
      const vision = await FilesetResolver.forVisionTasks(WASM);
      return (await PoseLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL, delegate: "CPU" },
        runningMode: "IMAGE",
        numPoses: 2,
      })) as unknown as Landmarker;
    } finally {
      console.error = error;
    }
  })();
  return landmarker;
}

export async function checkPhoto(blob: Blob): Promise<PhotoCheckResult> {
  const blocking: string[] = [];
  const tips: string[] = [];
  try {
    const bmp = await createImageBitmap(blob);
    if (Math.min(bmp.width, bmp.height) < 700) tips.push("The photo is quite small. A sharper photo gives a more accurate result.");
    const res = (await getLandmarker()).detect(bmp);
    bmp.close();
    const poses = res.landmarks ?? [];
    const seen = (p: { x: number; y: number; visibility?: number }[], i: number) => {
      const k = p[i];
      return !!k && (k.visibility ?? 1) > 0.5 && k.x > 0.01 && k.x < 0.99 && k.y > 0.01 && k.y < 0.99;
    };
    if (!poses.length) blocking.push("No person was found. Use a clear photo of one person standing, facing the camera.");
    else {
      if (poses.length > 1) blocking.push("More than one person is in the photo. Use a photo with only you in it.");
      const p = poses[0]!;
      if (!seen(p, 0) || !(seen(p, 2) || seen(p, 5)) || p[0]!.y < 0.06) blocking.push("Your face or head is cut off. The AI needs to see your face to know which way you are facing.");
      if (!seen(p, 15) || !seen(p, 16)) blocking.push("A hand is hidden (in a pocket or behind you). Stand with your arms relaxed by your sides.");
      if (!seen(p, 27) && !seen(p, 28)) tips.push("Your feet aren't visible. A head-to-feet photo works best, especially for trousers.");
    }
  } catch {
    tips.push("The automatic photo check couldn't run. Make sure your whole body is visible, face showing, arms by your sides.");
  }
  return { blocking, tips };
}
