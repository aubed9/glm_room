export function createJsonRequest<T>(body: T) {
  return {
    async json() {
      return body
    }
  } as any
}

export function createFormDataRequest(formData: FormData) {
  return {
    async formData() {
      return formData
    }
  } as any
}
