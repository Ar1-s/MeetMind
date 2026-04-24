// 录音服务，使用浏览器的 MediaRecorder API

class RecordingService {
  private mediaRecorder: MediaRecorder | null = null
  private audioChunks: Blob[] = []
  private stream: MediaStream | null = null
  private onDataAvailable: ((chunk: Blob) => void) | null = null
  private onStop: ((blob: Blob) => void) | null = null

  /**
   * 开始录音
   * @returns Promise<boolean> 是否成功开始录音
   */
  async startRecording(): Promise<boolean> {
    try {
      // 请求麦克风权限
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true })

      // 创建 MediaRecorder 实例
      this.mediaRecorder = new MediaRecorder(this.stream)
      this.audioChunks = []

      // 监听数据可用事件
      this.mediaRecorder.ondataavailable = event => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data)
          if (this.onDataAvailable) {
            this.onDataAvailable(event.data)
          }
        }
      }

      // 监听停止事件
      this.mediaRecorder.onstop = () => {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/wav' })
        if (this.onStop) {
          this.onStop(audioBlob)
        }
      }

      // 开始录音
      this.mediaRecorder.start()
      return true
    } catch (error) {
      console.error('开始录音失败:', error)
      return false
    }
  }

  /**
   * 停止录音
   * @returns Promise<Blob> 录音文件的 Blob 对象
   */
  stopRecording(): Promise<Blob> {
    return new Promise(resolve => {
      if (!this.mediaRecorder || !this.stream) {
        resolve(new Blob([], { type: 'audio/wav' }))
        return
      }

      // 监听停止事件
      this.onStop = blob => {
        // 停止所有音频轨道
        this.stream?.getTracks().forEach(track => track.stop())

        // 重置状态
        this.mediaRecorder = null
        this.stream = null
        this.onDataAvailable = null
        this.onStop = null

        resolve(blob)
      }

      // 停止录音
      this.mediaRecorder.stop()
    })
  }

  /**
   * 取消录音
   */
  cancelRecording(): void {
    if (this.mediaRecorder) {
      this.mediaRecorder.stop()
    }

    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop())
    }

    // 重置状态
    this.mediaRecorder = null
    this.stream = null
    this.audioChunks = []
    this.onDataAvailable = null
    this.onStop = null
  }

  /**
   * 检查是否正在录音
   * @returns boolean 是否正在录音
   */
  isRecording(): boolean {
    return this.mediaRecorder !== null && this.mediaRecorder.state === 'recording'
  }

  /**
   * 设置数据可用回调
   * @param callback 数据可用回调函数
   */
  setOnDataAvailable(callback: (chunk: Blob) => void): void {
    this.onDataAvailable = callback
  }
}

// 导出单例实例
export const recordingService = new RecordingService()
