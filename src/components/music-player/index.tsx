import { useRef, useState, useEffect } from "react";
import classnams from "classnames";
import styles from "./index.module.scss";
import "boxicons";
function createAudioContext(audio: HTMLAudioElement) {
  // 创建AudioContext
  const audioContext = new window.AudioContext();

  // 创建音频源节点
  const sourceNode = audioContext.createMediaElementSource(audio);

  // 创建分析器节点
  const analyserNode = audioContext.createAnalyser();
  analyserNode.fftSize = 2048; //频域大小
  const bufferLength = analyserNode.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);

  // 存储时域数据
  const timeDomainData = new Uint8Array(analyserNode.fftSize);
  const frequencyDataArray = new Uint8Array(bufferLength);
  const sampleRate = audioContext.sampleRate;

  // 连接节点
  sourceNode.connect(analyserNode);
  analyserNode.connect(audioContext.destination);
  return {
    audioContext,
    analyserNode,
    dataArray,
    timeDomainData,
    frequencyDataArray,
    sampleRate,
    sourceNode,
  };
}
function MusicPlayer() {
  const [playerStatus, setPlayerStatus] = useState(0);
  const [color, setColor] = useState("#fff");
  const [hue, setHue] = useState(0);
  const [radius, setRadius] = useState(0);
  const [audioSrc, setAudioSrc] = useState("");
  const [audioName, setAudioName] = useState("");

  const audioRef = useRef<HTMLAudioElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  //频谱针宽度
  const WIDTH = 16;
  // // 创建音频上下文,创建音频源节点,创建音频解析器
  // const audioContext = new AudioContext();
  // let sourceNode: AudioNode, analyserNode: AnalyserNode;
  // // 空数组用于存放解析数据
  // const dataArray = new Uint8Array(0);
  // const timeDomainData = new Uint8Array(0);
  // const frequencyDataArray = new Uint8Array(0);

  const handlePlay = () => {
    setPlayerStatus(1);
    if (audioCtxRef.current!.state === "suspended") {
      audioCtxRef.current!.resume();
    }
    audioRef.current!.play();
  };

  const handlePause = () => {
    setPlayerStatus(0);
    audioRef.current!.pause();
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };
  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file && file.type.startsWith("audio/")) {
      const audioURL = URL.createObjectURL(file);
      setAudioName(file.name);
      setAudioSrc(audioURL);
      handlePlay();
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d");
    canvasCtxRef.current = ctx;
    let destroyed = false; // 终止递归
    const {
      audioContext,
      sourceNode,
      analyserNode,
      dataArray,
      timeDomainData,
    } = createAudioContext(audioRef.current!);
    audioCtxRef.current = audioContext;

    // 绘制函数
    function draw() {
      if (destroyed) {
        return;
      }
      // 递归绘制
      requestAnimationFrame(draw);
      // 检查是否已经创建过AudioContext
      if (canvas && ctx && audioContext) {
        // 获取频域数据
        analyserNode.getByteFrequencyData(dataArray);
        // 清空画布
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        // 开始获取波长
        const len = getWaveLength();
        //呼吸灯扩散半径
        setRadius((Math.round(len * 1000) / 10) * 50);

        let x = 0;
        // 绘制频谱
        const barWidth = (canvas.width / dataArray.length) * WIDTH;
        for (let i = 0; i < dataArray.length / WIDTH; i++) {
          const barHeight = dataArray[i * WIDTH];
          const [r, g, b] = [
            255 - Math.random() * barHeight,
            Math.random() * barHeight,
            120,
          ];

          const newColor = `rgb(${r}, ${g}, ${b})`;
          setColor(newColor);
          ctx.fillStyle = newColor;
          ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
          x += barWidth + WIDTH / 4;
        }
      }
    }
    // 获取并计算频谱当前帧的波长
    function getWaveLength() {
      analyserNode.getByteTimeDomainData(timeDomainData);
      return calculateWaveLength(timeDomainData);
    }

    // 计算周期波长函数
    function calculateWaveLength(timeDomainData: Uint8Array) {
      // 寻找波形的零交叉点
      let zeroCrossing = -1; // 零交叉点索引初始化为-1

      const bufferLength = timeDomainData.length; // 获取时间域数据的长度
      // 遍历时间域数据寻找零交叉点
      for (let i = 0; i < bufferLength - 1; i++) {
        // 判断当前样本与下一个样本的值是否跨越零点（128为阈值）
        if (
          (timeDomainData[i] >= 128 && timeDomainData[i + 1] < 128) ||
          (timeDomainData[i] < 128 && timeDomainData[i + 1] >= 128)
        ) {
          zeroCrossing = i; // 找到零交叉点，记录索引
          break; // 已找到零交叉点，跳出循环
        }
      }

      // 计算周期波长
      if (zeroCrossing !== -1) {
        // 如果找到了零交叉点
        const sampleRate = audioContext.sampleRate; // 获取采样率（音频上下文的采样率）
        const period = (zeroCrossing / bufferLength) * (1 / sampleRate); // 计算周期（占比乘以时长）
        return period * sampleRate; // 返回周期波长（周期乘以采样率）
      }

      return 0; // 如果未找到零交叉点，则返回0，表示未计算到波长
    }

    draw();

    return () => {
      destroyed = true;
      sourceNode.disconnect();
      audioContext.close();
    };
  }, []);

  return (
    <div
      className={styles.container}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      style={{
        // backgroundColor: `hsl(${hue}deg 100% 50%) `,
        "--hue": `${hue}deg`,
      }}
    >
      <audio ref={audioRef} controls src={audioSrc || ""}></audio>
      <div
        style={
          playerStatus
            ? {
                filter: `drop-shadow(0 0 ${radius}px ${color}) hue-rotate(var(--hue))`,
                border: `solid .25rem ${color}`,
              }
            : {
                filter: `drop-shadow(0 0 0 ${color})`,
                border: `solid .25rem transparent`,
              }
        }
        className={styles["audio-player"]}
      >
        <canvas width="400" height="400" ref={canvasRef}></canvas>
        <h1>{audioName}</h1>
      </div>
      <div className={styles["contorl-bar"]}>
        <button
          className={playerStatus ? styles["active"] : ""}
          onClick={handlePlay}
        >
          <i className={classnams(styles["bx"], "bx", "bx-play")}></i>
        </button>
        <button
          onClick={handlePause}
          className={!playerStatus ? styles["active"] : ""}
        >
          <i className="bx bx-pause"></i>
        </button>
      </div>
      <input
        type="range"
        id="hue"
        min="0"
        max="360"
        defaultValue="0"
        step="1"
        onInput={(e) => setHue(e.target.valueAsNumber)}
      />
    </div>
  );
}

export default MusicPlayer;
