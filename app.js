"use strict";

const $ = (s, root = document) => root.querySelector(s);
const FFMPEG_CORE = "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js";
const CF = "https://speed.cloudflare.com";

const fmtSize = (bytes) =>
  bytes >= 1e6 ? `${(bytes / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1e3))} KB`;

/* ---------- Navigation ---------- */
let mode = "tools", tool = "convert", ipLoaded = false;

function render() {
  document.body.dataset.mode = mode;
  const active = mode === "speed" ? "speed" : tool;
  document.querySelectorAll(".panel").forEach((p) => (p.hidden = p.id !== active));
  document.querySelectorAll(".modes button").forEach((b) =>
    b.setAttribute("aria-pressed", String(b.dataset.mode === mode)));
  document.querySelectorAll("[role=tab]").forEach((t) =>
    t.setAttribute("aria-selected", String(t.dataset.panel === tool)));
  if (mode === "speed" && !ipLoaded) {
    ipLoaded = true;
    loadIpInfo();
  }
}
document.querySelectorAll(".modes button").forEach((b) =>
  b.addEventListener("click", () => { mode = b.dataset.mode; render(); }));
document.querySelectorAll("[role=tab]").forEach((t) =>
  t.addEventListener("click", () => { tool = t.dataset.panel; mode = "tools"; render(); }));

/* Show the chosen file name inside each drop zone */
document.querySelectorAll(".drop input").forEach((input) => {
  const label = $(".drop-name", input.parentElement);
  const hint = label.textContent;
  input.addEventListener("change", () => {
    const f = input.files[0];
    label.textContent = f ? `${f.name} (${fmtSize(f.size)})` : hint;
  });
});

/* ---------- Video (ffmpeg.wasm) ---------- */
let ffmpeg = null;

async function getFFmpeg(onProgress) {
  if (!ffmpeg) {
    ffmpeg = FFmpeg.createFFmpeg({ corePath: FFMPEG_CORE });
    await ffmpeg.load();
  }
  ffmpeg.setProgress(({ ratio }) => onProgress(Math.min(1, Math.max(0, ratio))));
  return ffmpeg;
}

async function runVideo(panelId, buildArgs, suffix) {
  const panel = $("#" + panelId);
  const file = $("input[type=file]", panel).files[0];
  const status = $(".status", panel);
  const bar = $("progress", panel);
  const out = $(".out", panel);
  const button = $("button.go", panel);

  if (!file) {
    status.textContent = "Choose a video file first.";
    return;
  }
  button.disabled = true;
  out.replaceChildren();
  bar.hidden = false;
  bar.value = 0;
  status.textContent = "Loading the converter (about 25 MB, first run only)…";

  const input = "input" + (file.name.match(/\.[^.]+$/) || [".mp4"])[0];
  try {
    const ff = await getFFmpeg((ratio) => {
      bar.value = ratio;
      status.textContent = `Processing… ${Math.round(ratio * 100)}%`;
    });
    ff.FS("writeFile", input, await FFmpeg.fetchFile(file));
    await ff.run("-i", input, ...buildArgs(), "-pix_fmt", "yuv420p", "output.mp4");
    const data = ff.FS("readFile", "output.mp4");
    ff.FS("unlink", input);
    ff.FS("unlink", "output.mp4");

    const blob = new Blob([data.buffer], { type: "video/mp4" });
    const link = document.createElement("a");
    link.className = "btn";
    link.href = URL.createObjectURL(blob);
    link.download = file.name.replace(/\.[^.]+$/, "") + suffix + ".mp4";
    link.textContent = `Download MP4 (${fmtSize(blob.size)})`;
    out.append(link);
    status.textContent = `Done. ${fmtSize(file.size)} → ${fmtSize(blob.size)}.`;
  } catch (err) {
    status.textContent = `Could not process this file (${err.message || err}). Try a smaller file.`;
  } finally {
    button.disabled = false;
    bar.hidden = true;
  }
}

$("#convert .go").addEventListener("click", () =>
  runVideo("convert",
    () => ["-c:v", "libx264", "-preset", "veryfast", "-crf", "23",
           "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart"],
    ""));

const LEVELS = {
  light:    { crf: "28", height: null },
  balanced: { crf: "32", height: 720 },
  strong:   { crf: "36", height: 480 },
};
$("#compress .go").addEventListener("click", () =>
  runVideo("compress", () => {
    const { crf, height } = LEVELS[$("#level").value];
    const args = ["-c:v", "libx264", "-preset", "veryfast", "-crf", crf,
                  "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart"];
    if (height) args.push("-vf", `scale=-2:'min(${height},ih)'`);
    return args;
  }, "-compressed"));

/* ---------- Image to text (Tesseract.js) ---------- */
const ocrFile = $("#ocrFile");
const ocrPreview = $("#ocrPreview");

ocrFile.addEventListener("change", () => {
  const file = ocrFile.files[0];
  if (!file) return;
  ocrPreview.src = URL.createObjectURL(file);
  ocrPreview.hidden = false;
});

window.addEventListener("paste", (event) => {
  const image = [...event.clipboardData.files].find((f) => f.type.startsWith("image/"));
  if (!image) return;
  const transfer = new DataTransfer();
  transfer.items.add(image);
  ocrFile.files = transfer.files;
  ocrFile.dispatchEvent(new Event("change"));
});

$("#ocrGo").addEventListener("click", async () => {
  const panel = $("#ocr");
  const status = $(".status", panel);
  const bar = $("progress", panel);
  const button = $("#ocrGo");
  const file = ocrFile.files[0];
  if (!file) {
    status.textContent = "Choose an image first.";
    return;
  }
  button.disabled = true;
  bar.hidden = false;
  bar.value = 0;
  status.textContent = "Loading language data…";
  try {
    const result = await Tesseract.recognize(file, $("#ocrLang").value, {
      logger: (m) => {
        if (m.status === "recognizing text") {
          bar.value = m.progress;
          status.textContent = `Reading text… ${Math.round(m.progress * 100)}%`;
        }
      },
    });
    const text = result.data.text.trim();
    $("#ocrText").value = text;
    status.textContent = text ? "Done." : "No text found in this image.";
  } catch (err) {
    status.textContent = `Could not read this image (${err.message || err}).`;
  } finally {
    button.disabled = false;
    bar.hidden = true;
  }
});

$("#ocrCopy").addEventListener("click", async () => {
  const text = $("#ocrText").value;
  if (!text) return;
  await navigator.clipboard.writeText(text);
  $("#ocr .status").textContent = "Copied to clipboard.";
});

/* ---------- IP, country and ISP ---------- */
function showIp(ip, country, isp) {
  $("#ipAddr").textContent = ip || "Unavailable";
  $("#ipCountry").textContent = country || "Unavailable";
  $("#ipIsp").textContent = isp || "Unavailable";
}

async function loadIpInfo() {
  try {
    const r = await (await fetch("https://ipwho.is/")).json();
    if (!r.success) throw new Error(r.message);
    showIp(r.ip, [r.city, r.country].filter(Boolean).join(", "), r.connection?.isp || r.connection?.org);
  } catch {
    try {
      const r = await (await fetch("https://ipapi.co/json/")).json();
      showIp(r.ip, [r.city, r.country_name].filter(Boolean).join(", "), r.org);
    } catch {
      showIp();
    }
  }
}

/* ---------- Speed test ---------- */
const mbps = (bytes, ms) => ((bytes * 8) / (ms / 1000) / 1e6);
const show = (id, value) => ($("#" + id).textContent = value);

async function measurePing() {
  const times = [];
  for (let i = 0; i < 8; i++) {
    const t0 = performance.now();
    await fetch(`${CF}/__down?bytes=0&r=${Math.random()}`, { cache: "no-store" });
    times.push(performance.now() - t0);
  }
  const avg = times.reduce((a, b) => a + b) / times.length;
  const jitter = times.slice(1).reduce((s, t, i) => s + Math.abs(t - times[i]), 0) / (times.length - 1);
  show("mPing", Math.round(Math.min(...times)));
  show("mJit", jitter.toFixed(1));
  return avg;
}

async function measureDownload(seconds = 8) {
  const controller = new AbortController();
  const t0 = performance.now();
  let received = 0;
  const stop = setTimeout(() => controller.abort(), seconds * 1000);
  try {
    const res = await fetch(`${CF}/__down?bytes=100000000&r=${Math.random()}`,
      { cache: "no-store", signal: controller.signal });
    const reader = res.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.length;
      show("mDown", mbps(received, performance.now() - t0).toFixed(1));
    }
  } catch (err) {
    if (err.name !== "AbortError") throw err;
  } finally {
    clearTimeout(stop);
  }
}

async function measureUpload(rounds = 3) {
  const payload = new Blob([new Uint8Array(4 * 1024 * 1024)]);
  let bytes = 0;
  const t0 = performance.now();
  for (let i = 0; i < rounds; i++) {
    await fetch(`${CF}/__up`, { method: "POST", body: payload, cache: "no-store" });
    bytes += payload.size;
    show("mUp", mbps(bytes, performance.now() - t0).toFixed(1));
  }
}

$("#speedGo").addEventListener("click", async () => {
  const button = $("#speedGo");
  const status = $("#speedStatus");
  button.disabled = true;
  ["mDown", "mUp", "mPing", "mJit"].forEach((id) => show(id, "–"));
  try {
    status.textContent = "Measuring ping…";
    await measurePing();
    status.textContent = "Testing download…";
    await measureDownload();
    status.textContent = "Testing upload…";
    await measureUpload();
    status.textContent = "Test complete.";
  } catch (err) {
    status.textContent = "The test was interrupted. Check your connection and try again.";
  } finally {
    button.disabled = false;
  }
});

/* ---------- Duty and break calculator ---------- */
const toMin = (v) => { const [h, m] = v.split(":").map(Number); return h * 60 + m; };
const wrap = (from, to) => (toMin(to) - toMin(from) + 1440) % 1440;
const hm = (min) => `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, "0")}m`;
const breaksBox = $("#breaks");

function addBreak(start = "", end = "") {
  const row = document.createElement("div");
  row.className = "break-row";
  row.innerHTML = `<label class="field">Break start<input type="time" class="bs" value="${start}"></label>
    <label class="field">Break end<input type="time" class="be" value="${end}"></label>
    <button type="button" class="secondary" aria-label="Remove break">Remove</button>`;
  $("button", row).addEventListener("click", () => { row.remove(); calcDuty(); });
  breaksBox.append(row);
}

let dutySummary = "";
function calcDuty() {
  const start = $("#dStart").value, end = $("#dEnd").value;
  const msg = $("#dutyMsg");
  if (!start || !end) { msg.textContent = "Enter the duty start and end time."; return; }
  const gross = wrap(start, end);
  let breaks = 0, problem = "";
  breaksBox.querySelectorAll(".break-row").forEach((row, i) => {
    const bs = $(".bs", row).value, be = $(".be", row).value;
    if (!bs || !be) return;
    const len = wrap(bs, be);
    if (wrap(start, bs) + len > gross) problem = `Break ${i + 1} falls outside the duty hours.`;
    breaks += len;
  });
  const net = Math.max(0, gross - breaks);
  const diff = net - Math.round(parseFloat($("#dStd").value || 0) * 60);
  show("dGross", hm(gross));
  show("dBreak", hm(breaks));
  show("dNet", hm(net));
  show("dOver", hm(Math.abs(diff)));
  show("dOverLabel", diff >= 0 ? "Overtime" : "Short of standard hours");
  msg.textContent = problem;
  dutySummary = `Duty ${start}–${end}: ${hm(gross)} total, ${hm(breaks)} breaks, ${hm(net)} net` +
    (diff ? `, ${diff > 0 ? "overtime" : "short by"} ${hm(Math.abs(diff))}` : "");
}

["dStart", "dEnd", "dStd"].forEach((id) => $("#" + id).addEventListener("input", calcDuty));
breaksBox.addEventListener("input", calcDuty);
$("#addBreak").addEventListener("click", () => addBreak());
$("#dutyCopy").addEventListener("click", async () => {
  await navigator.clipboard.writeText(dutySummary);
  $("#dutyMsg").textContent = "Summary copied.";
});
addBreak("13:00", "14:00");
calcDuty();
