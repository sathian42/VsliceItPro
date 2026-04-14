let ffmpeg = null;

document.addEventListener("DOMContentLoaded", () => {
  const startBtn = document.getElementById("startBtn");

  const log = (msg) => {
    const consoleLog = document.getElementById("console");
    const time = new Date().toLocaleTimeString([], { hour12: false });
    consoleLog.innerHTML += `<br><span style="color: #666;">[${time}]</span> ${msg}`;
    consoleLog.scrollTop = consoleLog.scrollHeight;
  };

  const hmsToSeconds = (hms) => {
    if (!hms || !hms.includes(":")) return 0;
    const p = hms.split(":").map((s) => s.trim());
    let s = 0,
      m = 1;
    while (p.length > 0) {
      s += m * parseInt(p.pop(), 10);
      m *= 60;
    }
    return s;
  };

  const process = async () => {
    const file = document.getElementById("videoInput").files[0];
    if (!file) return alert("Select a video!");

    try {
      startBtn.disabled = true;

      const { FFmpeg } = window.FFmpegWASM;
      const { toBlobURL, fetchFile } = window.FFmpegUtil;
      const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd";

      const video = document.createElement("video");
      video.src = URL.createObjectURL(file);
      await new Promise((r) => (video.onloadedmetadata = r));
      const totalDuration = video.duration;

      const omitText = document.getElementById("omitList").value;
      const omitRanges = omitText
        .split("\n")
        .filter((l) => l.includes("-"))
        .map((range) => {
          const parts = range.split("-").map((p) => hmsToSeconds(p.trim()));
          return { start: parts[0], end: parts[1] };
        });

      let currentSec = 0;
      let partNum = 1;
      const splitSec =
        parseFloat(document.getElementById("splitSeconds").value) || 60;

      while (currentSec < totalDuration) {
        const inOmit = omitRanges.find(
          (r) => currentSec >= r.start && currentSec < r.end,
        );
        if (inOmit) {
          log(`⏭️ Skipping Omit: ${currentSec}s to ${inOmit.end}s`);
          currentSec = inOmit.end;
          continue;
        }

        // --- SAFE REFRESH ---
        // Terminate the OLD worker before starting the NEW one to clear RAM
        if (ffmpeg) {
          log("🧹 Clearing memory for next part...");
          await ffmpeg.terminate();
        }

        ffmpeg = new FFmpeg();
        await ffmpeg.load({
          coreURL: await toBlobURL(
            `${baseURL}/ffmpeg-core.js`,
            "text/javascript",
          ),
          wasmURL: await toBlobURL(
            `${baseURL}/ffmpeg-core.wasm`,
            "application/wasm",
          ),
        });

        log("🔤 Injecting Font...");
        const selectedFontFile = document.getElementById("fontSelect").value;
        const fontUrl = `fonts/${selectedFontFile}`;

        try {
          // Fetch the specific font file from your /fonts folder
          const fontData = await fetchFile(fontUrl);
          // Write it to the virtual disk as 'myfont.ttf'
          // We keep the internal name 'myfont.ttf' so the filter code doesn't have to change
          await ffmpeg.writeFile("myfont.ttf", fontData);
        } catch (e) {
          log(
            `❌ Font Error: Make sure ${selectedFontFile} is in the /fonts folder`,
          );
        }

        log(`📂 Writing Part ${partNum} to Disk...`);
        await ffmpeg.writeFile("input.mp4", await fetchFile(file));

        const movieName =
          document.getElementById("movieTitle").value || "V-Slice";
        const ratio = document.getElementById("aspectRatio").value;

        let filter =
          ratio === "9:16"
            ? `scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280:(ow-iw)/2:(oh-ih)/2:black`
            : `scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:black`;

        if (document.getElementById("showTopText").checked) {
          // 1. Get the custom label (like "Part", "Episode", or "Bagam")
          const customLabel =
            document.getElementById("segmentPrefix").value || "PART";

          // 2. Combine it with the part number
          const topDisplayText = `${customLabel} ${partNum}`;

          // 3. Update the filter to use the new variable
          filter += `,drawtext=fontfile='myfont.ttf':text='${topDisplayText}':fontcolor=white:fontsize=45:x=(w-text_w)/2:y=300`;
        }
        if (document.getElementById("showBottomText").checked) {
          filter += `,drawtext=fontfile='myfont.ttf':text='${movieName}':fontcolor=yellow:fontsize=45:x=(w-text_w)/2:y=h-th-300`;
        }

        log(`⏳ Encoding Part ${partNum}...`);

        await ffmpeg.exec([
          "-ss",
          currentSec.toString(),
          "-t",
          splitSec.toString(),
          "-i",
          "input.mp4",
          "-vf",
          filter,
          "-c:v",
          "libx264",
          "-preset",
          "ultrafast",
          "-crf",
          "20",
          "-threads",
          "1",
          "-c:a",
          "copy",
          "out.mp4",
        ]);

        // Read file into a local constant so it's not "detached"
        const data = await ffmpeg.readFile("out.mp4");

        if (data && data.byteLength > 1000) {
          const blob = new Blob([data.buffer], { type: "video/mp4" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `${movieName}_Part_${partNum}.mp4`;
          document.body.appendChild(a);
          a.click();
          log(`✅ Part ${partNum} Complete!`);

          // Small delay before moving to the next part to let the UI breathe
          await new Promise((r) => setTimeout(r, 2000));
        }

        currentSec += splitSec;
        partNum++;
      }
      log("🏆 ALL TASKS COMPLETE!");
    } catch (err) {
      log(`❌ ERROR: ${err.message}`);
    } finally {
      startBtn.disabled = false;
    }
  };

  startBtn.addEventListener("click", process);
});
