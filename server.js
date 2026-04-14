
const { FFmpeg } = window.FFmpegWASM;
const { fetchFile, toBlobURL } = window.FFmpegUtil;
const ffmpeg = new FFmpeg();

document.addEventListener('DOMContentLoaded', () => {
    const logElement = document.getElementById('log');
    const startBtn = document.getElementById('startBtn');
    const videoInput = document.getElementById('videoInput');
    const movieTitleInput = document.getElementById('movieTitle');
    const aspectSelect = document.getElementById('aspectRatio');

    const updateStatus = (text) => {
        logElement.innerHTML += `<br>> ${text}`;
        logElement.scrollTop = logElement.scrollHeight;
    };

    // Monitor FFmpeg internal logs for errors
    ffmpeg.on('log', ({ message }) => {
        console.log("FFmpeg:", message);
        if (message.includes('frame=')) {
            const stats = message.match(/frame=\s*(\d+).*fps=\s*([\d.]+)/);
            if (stats) {
                // Update status in place to avoid a massive wall of text
                logElement.lastChild.innerHTML = `> Rendering Frame: ${stats[1]} (${stats[2]} fps)`;
            }
        }
    });

    const processVideo = async () => {
        const file = videoInput.files[0];
        const movieName = movieTitleInput.value.trim() || 'My_Movie';
        const ratio = aspectSelect.value;

        if (!file) return alert("Please select a video file!");

        try {
            startBtn.disabled = true;
            updateStatus("Initializing FFmpeg Engine...");

            const baseURL = window.location.origin + '/ffmpeg-core';
            await ffmpeg.load({
                coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
                wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
                workerURL: await toBlobURL(`${window.location.origin}/814.ffmpeg.js`, 'text/javascript'),
            });

            // 1. LOAD FONT (CRITICAL: Files will be empty if font fails)
            updateStatus("Loading font.ttf...");
            try {
                const fontResponse = await fetch('font.ttf');
                if (!fontResponse.ok) throw new Error("Font not found on server");
                const fontData = await fetchFile('font.ttf');
                await ffmpeg.writeFile('font.ttf', fontData);
            } catch (e) {
                updateStatus("❌ ERROR: font.ttf not found in folder. Place a font file named 'font.ttf' in your project folder.");
                startBtn.disabled = false;
                return;
            }

            updateStatus("Reading Video Data...");
            await ffmpeg.writeFile('input.mp4', await fetchFile(file));

            // 2. CONSTRUCT FILTERS
            let resize = "";
            if (ratio === "9:16") {
                resize = "crop=ih*(9/16):ih,scale=720:1280";
            } else if (ratio === "1:1") {
                resize = "crop=ih:ih,scale=1080:1080";
            } else {
                resize = "scale=1280:720";
            }

            // Drawtext with explicit fontfile path
            const vFilter = `${resize},drawtext=fontfile=font.ttf:text='PART %{eif\\:n+1\\:d}':fontcolor=white:fontsize=50:x=(w-text_w)/2:y=80,drawtext=fontfile=font.ttf:text='${movieName}':fontcolor=yellow:fontsize=45:x=(w-text_w)/2:y=h-130`;

            updateStatus("Encoding Started... (Processing Frames)");

            // 3. EXECUTE RE-ENCODING
            await ffmpeg.exec([
                '-i', 'input.mp4',
                '-vf', vFilter,
                '-c:v', 'libx264',
                '-preset', 'ultrafast',
                '-crf', '30',           // Slightly lower quality to ensure speed/memory stability
                '-pix_fmt', 'yuv420p',  // Standard format for all players
                '-c:a', 'aac',          // Re-encode audio to prevent sync errors
                '-b:a', '128k',
                '-f', 'segment',
                '-segment_time', '60',  // 1-minute segments
                '-reset_timestamps', '1',
                'part%d.mp4'
            ]);

            updateStatus("Encoding Finished. Checking results...");

            const zip = new JSZip();
            let foundCount = 0;

            // 4. VERIFY AND ZIP FILES
            for (let i = 0; i < 200; i++) {
                try {
                    const data = await ffmpeg.readFile(`part${i}.mp4`);
                    if (data && data.length > 500) { // Check if file is actually a video, not just a header
                        zip.file(`${movieName}_Part_${i + 1}.mp4`, data);
                        foundCount++;
                    }
                } catch (e) {
                    break; // No more files
                }
            }

            if (foundCount === 0) {
                throw new Error("No video files were generated. The filter might have failed.");
            }

            updateStatus(`Success! Generated ${foundCount} parts. Zipping...`);

            const zipBlob = await zip.generateAsync({ type: 'blob' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(zipBlob);
            link.download = `${movieName}_Split_Project.zip`;
            link.click();
            
            updateStatus("✅ Download Complete!");

        } catch (err) {
            console.error(err);
            updateStatus(`❌ FATAL ERROR: ${err.message}`);
        } finally {
            startBtn.disabled = false;
        }
    };

    startBtn.addEventListener('click', processVideo);
});