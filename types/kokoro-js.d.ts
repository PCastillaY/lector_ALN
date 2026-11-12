declare module "kokoro-js" {
  export const KokoroTTS: {
    from_pretrained(
      modelId: string,
      options: {
        dtype: "q8" | "fp32"
        device: "wasm" | "webgpu"
        progress_callback?: (event: Record<string, unknown>) => void
      },
    ): Promise<{
      list_voices(): string[]
      generate(
        text: string,
        options: { voice: "ef_dora" | "em_alex" | "em_santa"; speed: number },
      ): Promise<{ toBlob(): Blob }>
    }>
  }
}
