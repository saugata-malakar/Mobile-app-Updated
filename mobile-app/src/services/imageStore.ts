// mobile-app/src/services/imageStore.ts
// Singleton in-memory image store to avoid passing massive Base64 strings
// through React Navigation parameters (which causes Android TransactionTooLargeException).

class ImageStore {
  private originalB64: string = '';
  private annotatedB64: string = '';
  private previewUri: string = '';

  setImages(originalB64: string, annotatedB64?: string, previewUri?: string) {
    this.originalB64 = originalB64 || '';
    this.annotatedB64 = annotatedB64 || originalB64 || '';
    this.previewUri = previewUri || '';
  }

  getOriginal(): string {
    return this.originalB64;
  }

  getAnnotated(): string {
    return this.annotatedB64 || this.originalB64;
  }

  getPreviewUri(): string {
    return this.previewUri;
  }

  clear() {
    this.originalB64 = '';
    this.annotatedB64 = '';
    this.previewUri = '';
  }
}

export const imageStore = new ImageStore();
