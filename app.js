const AudioCtx =
window.AudioContext ||
window.webkitAudioContext;

const audioContext = new AudioCtx();

const statusBox = document.getElementById("status");
const progressBar = document.getElementById("progress");
const startBtn = document.getElementById("startBtn");

function log(message){
    statusBox.textContent += "\n" + message;
    statusBox.scrollTop = statusBox.scrollHeight;
}

startBtn.addEventListener("click", processFiles);

async function processFiles(){

    const files =
        document.getElementById("files").files;

    const duration =
        parseFloat(
            document.getElementById("duration").value
        );

    if(files.length === 0){
        alert("Please select WAV files.");
        return;
    }

    if(typeof JSZip === "undefined"){
        alert("JSZip failed to load.");
        return;
    }

    statusBox.textContent = "Starting...\n";
    progressBar.value = 0;
    startBtn.disabled = true;

    const zip = new JSZip();

    try{

        for(let i=0;i<files.length;i++){

            const file = files[i];

            log("Processing " + file.name);

            const buffer =
                await file.arrayBuffer();

            const decoded =
                await audioContext.decodeAudioData(
                    buffer.slice(0)
                );

            const sampleRate =
                decoded.sampleRate;

            const samples =
                Math.min(
                    Math.floor(duration * sampleRate),
                    decoded.length
                );

            const trimmed =
                audioContext.createBuffer(
                    decoded.numberOfChannels,
                    samples,
                    sampleRate
                );

            for(
                let ch=0;
                ch<decoded.numberOfChannels;
                ch++
            ){

                trimmed
                .getChannelData(ch)
                .set(
                    decoded
                    .getChannelData(ch)
                    .slice(0,samples)
                );
            }

            const wavBlob =
                bufferToWave(trimmed,samples);

            const outputName =
                file.name.replace(
                    /\.wav$/i,
                    "_trimmed.wav"
                );

            zip.file(outputName,wavBlob);

            progressBar.value =
                ((i + 1) / files.length) * 80;

            log("✓ " + outputName);
        }

        log("Creating ZIP...");

        const zipBlob =
            await zip.generateAsync(
                {
                    type:"blob",
                    compression:"DEFLATE"
                },
                meta => {
                    progressBar.value =
                        80 + (meta.percent * 0.2);
                }
            );

        const url =
            URL.createObjectURL(zipBlob);

        const link =
            document.createElement("a");

        link.href = url;
        link.download =
            "trimmed_wav_files.zip";

        document.body.appendChild(link);
        link.click();
        link.remove();

        URL.revokeObjectURL(url);

        progressBar.value = 100;

        log("Finished.");
    }
    catch(err){

        console.error(err);
        log("ERROR: " + err.message);
    }

    startBtn.disabled = false;
}

function bufferToWave(buffer,length){

    const numChannels =
        buffer.numberOfChannels;

    const sampleRate =
        buffer.sampleRate;

    const bytesPerSample = 2;
    const blockAlign =
        numChannels * bytesPerSample;

    const wav =
        new ArrayBuffer(
            44 + length * blockAlign
        );

    const view =
        new DataView(wav);

    writeString(view,0,"RIFF");

    view.setUint32(
        4,
        36 + length * blockAlign,
        true
    );

    writeString(view,8,"WAVE");
    writeString(view,12,"fmt ");

    view.setUint32(16,16,true);
    view.setUint16(20,1,true);
    view.setUint16(22,numChannels,true);
    view.setUint32(24,sampleRate,true);

    view.setUint32(
        28,
        sampleRate * blockAlign,
        true
    );

    view.setUint16(32,blockAlign,true);
    view.setUint16(34,16,true);

    writeString(view,36,"data");

    view.setUint32(
        40,
        length * blockAlign,
        true
    );

    let offset = 44;

    for(let i=0;i<length;i++){

        for(
            let ch=0;
            ch<numChannels;
            ch++
        ){

            let sample =
                buffer
                .getChannelData(ch)[i];

            sample =
                Math.max(
                    -1,
                    Math.min(1,sample)
                );

            view.setInt16(
                offset,
                sample < 0
                    ? sample * 32768
                    : sample * 32767,
                true
            );

            offset += 2;
        }
    }

    return new Blob(
        [view],
        {type:"audio/wav"}
    );
}

function writeString(view,offset,text){

    for(let i=0;i<text.length;i++){

        view.setUint8(
            offset+i,
            text.charCodeAt(i)
        );
    }
}
