import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../src/App'
import { loadSession, saveSession } from '../src/storage'
import { compressImage } from '../src/compressImage'

const { recogniseHandwriting, testApiKey, OpenAiWrapperMock } = vi.hoisted(() => {
  const recogniseHandwriting = vi.fn()
  const testApiKey = vi.fn()
  const OpenAiWrapperMock = vi.fn().mockImplementation(() => ({
    recogniseHandwriting,
    testApiKey,
  }))

  return { recogniseHandwriting, testApiKey, OpenAiWrapperMock }
})

vi.mock('../src/compressImage', () => ({ compressImage: vi.fn() }))

vi.mock('../src/storage', async importOriginal => ({ ...await importOriginal<typeof import('../src/storage')>(), loadSession: vi.fn(), saveSession: vi.fn() }))

vi.mock('../src/openai/OpenAiWrapper', () => ({
  default: OpenAiWrapperMock,
}))

vi.mock('react-toastify', () => ({
  ToastContainer: () => null,
  toast: {
    error: vi.fn(),
  },
}))

vi.mock('../src/assets/arrow-left-solid-full.svg?react', () => ({
  default: () => <span>BackIcon</span>,
}))
vi.mock('../src/assets/photo-film-solid-full.svg?react', () => ({
  default: () => <span>PhotoIcon</span>,
}))
vi.mock('../src/assets/play-solid-full.svg?react', () => ({
  default: () => <span>PlayIcon</span>,
}))
vi.mock('../src/assets/trash-solid-full.svg?react', () => ({
  default: () => <span>TrashIcon</span>,
}))
vi.mock('../src/assets/pinch-to-zoom.svg?react', () => ({
  default: () => <span>PinchIcon</span>,
}))

function mockFileReader() {
  class MockFileReader {
    result: string | ArrayBuffer | null = null
    onloadend: ((this: FileReader, ev: ProgressEvent<FileReader>) => void) | null = null

    readAsDataURL() {
      this.result = 'data:image/png;base64,fakeimagecontent'
      this.onloadend?.call(this as unknown as FileReader, {} as ProgressEvent<FileReader>)
    }
  }

  vi.stubGlobal('FileReader', MockFileReader)
}

async function confirmApiKey(user: ReturnType<typeof userEvent.setup>, key = 'sk-test') {
  await user.type(screen.getByPlaceholderText('API-Key'), key)
  await user.click(screen.getByRole('button', { name: /submit/i }))
}

function getNavButton(label: string) {
  return screen.getByText(label).previousElementSibling as HTMLButtonElement
}

describe('App', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    vi.mocked(compressImage).mockImplementation(async file => file)
    vi.mocked(loadSession).mockResolvedValue({ id: 'current', shoppingList: [], image: null, fileName: '' })
    vi.mocked(saveSession).mockResolvedValue(undefined)
    vi.unstubAllGlobals()
    vi.stubGlobal('URL', class extends URL {
      static createObjectURL = vi.fn(() => 'blob:preview')
      static revokeObjectURL = vi.fn()
    })
    testApiKey.mockResolvedValue([])
    recogniseHandwriting.mockResolvedValue('milk,bread,eggs')
  })

  it('shows the API key form by default', async () => {
    await act(async () => { render(<App />) })

    expect(screen.getByLabelText(/enter an api key/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument()
    expect(screen.queryByText('Upload an image')).not.toBeInTheDocument()
  })

  it('enters the main UI after submitting an API key', async () => {
    const user = userEvent.setup()
    render(<App />)

    await confirmApiKey(user)

    expect(OpenAiWrapperMock).toHaveBeenCalledWith('sk-test')
    expect(screen.getByText('Upload an image')).toBeInTheDocument()
    expect(screen.getByText('Back')).toBeInTheDocument()
    expect(screen.getByText('Upload')).toBeInTheDocument()
    expect(screen.getByText('Process')).toBeInTheDocument()
    expect(screen.getByText('Clear')).toBeInTheDocument()
  })

  it('shows an error toast when the API key constructor fails', async () => {
    const { toast } = await import('react-toastify')
    OpenAiWrapperMock.mockImplementationOnce(() => {
      throw new Error('Api Key was not set')
    })

    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /submit/i }))

    expect(toast.error).toHaveBeenCalledWith(
      'Invalid API Key',
      expect.any(Object),
    )
    expect(screen.getByLabelText(/enter an api key/i)).toBeInTheDocument()
  })

  it('restores a saved shopping list after confirming a key', async () => {
    vi.mocked(loadSession).mockResolvedValue({ id: 'current', shoppingList: [{ name: 'butter', checked: true }], image: null, fileName: '' })

    const user = userEvent.setup()
    render(<App />)

    await confirmApiKey(user)

    expect(screen.getByText('butter')).toBeInTheDocument()
    expect(screen.getByRole('checkbox')).toBeChecked()
  })

  it('processes an uploaded image into a shopping list', async () => {
    mockFileReader()
    const user = userEvent.setup()
    render(<App />)

    await confirmApiKey(user)

    const file = new File(['fake-image'], 'list.png', { type: 'image/png' })
    const input = document.querySelector('#upload') as HTMLInputElement
    await user.upload(input, file)

    await waitFor(() => {
      expect(document.querySelector('.uploaded-image')).toBeInTheDocument()
    })

    const processButton = getNavButton('Process')
    expect(processButton).not.toBeDisabled()
    await user.click(processButton)

    await waitFor(() => {
      expect(screen.getByText('milk')).toBeInTheDocument()
      expect(screen.getByText('bread')).toBeInTheDocument()
      expect(screen.getByText('eggs')).toBeInTheDocument()
    })

    expect(recogniseHandwriting).toHaveBeenCalledOnce()
    expect(vi.mocked(saveSession).mock.calls.filter(call => call[1] instanceof Blob)).toHaveLength(1)
    expect(saveSession).toHaveBeenCalledWith(expect.objectContaining({ imageId: 'current' }), file)
    await waitFor(() => expect(saveSession).toHaveBeenLastCalledWith(expect.objectContaining({
      shoppingList: [{ name: 'milk', checked: false }, { name: 'bread', checked: false }, { name: 'eggs', checked: false }],
      imageId: 'current',
      fileName: 'list.png',
    })))
  })

  it('shows a processing error toast when OCR fails', async () => {
    mockFileReader()
    const { toast } = await import('react-toastify')
    recogniseHandwriting.mockRejectedValueOnce(new Error('network failure'))

    const user = userEvent.setup()
    render(<App />)

    await confirmApiKey(user)

    const file = new File(['fake-image'], 'list.png', { type: 'image/png' })
    await user.upload(document.querySelector('#upload') as HTMLInputElement, file)

    await waitFor(() => {
      expect(getNavButton('Process')).not.toBeDisabled()
    })

    await user.click(getNavButton('Process'))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Processing error', expect.any(Object))
    })
  })

  it('toggles a shopping list item when checked', async () => {
    vi.mocked(loadSession).mockResolvedValue({ id: 'current', shoppingList: [{ name: 'milk', checked: false }], image: null, fileName: '' })

    const user = userEvent.setup()
    render(<App />)

    await confirmApiKey(user)

    const checkbox = screen.getByRole('checkbox')
    await user.click(checkbox)

    expect(checkbox).toBeChecked()
    await waitFor(() => expect(saveSession).toHaveBeenLastCalledWith(expect.objectContaining({
      shoppingList: [{ name: 'milk', checked: true }],
    })))
  })

  it('clears the shopping list and image state', async () => {
    vi.mocked(loadSession).mockResolvedValue({ id: 'current', shoppingList: [{ name: 'milk', checked: false }], image: null, fileName: '' })
    vi.mocked(loadSession).mockResolvedValue({ id: 'current', shoppingList: [{ name: 'milk', checked: false }], imageId: 'current', image: new Blob(['image']), fileName: 'list.png' })

    const user = userEvent.setup()
    render(<App />)

    await confirmApiKey(user)

    expect(screen.getByText('milk')).toBeInTheDocument()

    await user.click(getNavButton('Clear'))

    expect(screen.queryByText('milk')).not.toBeInTheDocument()
    expect(screen.getByText('Upload an image')).toBeInTheDocument()
    await waitFor(() => expect(saveSession).toHaveBeenLastCalledWith({
      id: 'current', shoppingList: [], fileName: '',
    }, null))
  })


  it('returns to the API key form when Back is pressed', async () => {
    const user = userEvent.setup()
    render(<App />)

    await confirmApiKey(user)

    await user.click(getNavButton('Back'))

    expect(screen.getByLabelText(/enter an api key/i)).toBeInTheDocument()
    expect(screen.queryByText('Process')).not.toBeInTheDocument()
  })
  it('restores an image that can be processed after reload', async () => {
    mockFileReader()
    vi.mocked(loadSession).mockResolvedValue({ id: 'current', shoppingList: [], image: new Blob(['restored'], { type: 'image/png' }), imageId: 'current', fileName: 'saved.png' })
    const user = userEvent.setup()
    render(<App />)
    await confirmApiKey(user)
    expect(screen.getByAltText('saved.png')).toHaveAttribute('src', 'blob:preview')
    const readAsDataURL = vi.spyOn(FileReader.prototype, 'readAsDataURL')
    await user.click(getNavButton('Process'))
    await waitFor(() => expect(recogniseHandwriting).toHaveBeenCalledWith('data:image/png;base64,fakeimagecontent'))
    expect(readAsDataURL).toHaveBeenCalledWith(expect.any(Blob))
    expect(readAsDataURL.mock.calls[0][0]).not.toBeInstanceOf(File)
    readAsDataURL.mockRestore()
  })

  it('keeps existing data untouched when loading fails', async () => {
    vi.mocked(loadSession).mockRejectedValue(new Error('unavailable'))
    render(<App />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load saved data')
    expect(screen.getByRole('button', { name: /submit/i })).toBeDisabled()
    expect(saveSession).not.toHaveBeenCalled()
  })

  it('does not save an empty session before hydration completes', async () => {
    vi.mocked(loadSession).mockReturnValue(new Promise(() => {}))
    render(<App />)
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(saveSession).not.toHaveBeenCalled()
  })

  it('reports storage quota failures and retries saving on request', async () => {
    vi.mocked(saveSession).mockRejectedValue(new DOMException('Full', 'QuotaExceededError'))
    const user = userEvent.setup()
    render(<App />)
    await confirmApiKey(user)
    expect(await screen.findByRole('alert')).toHaveTextContent('Browser storage is full')
    vi.mocked(saveSession).mockResolvedValue(undefined)
    await user.click(screen.getByRole('button', { name: 'Retry save' }))
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
  })

  it('checks duplicate items independently', async () => {
    vi.mocked(loadSession).mockResolvedValue({ id: 'current', shoppingList: [{name: 'milk', checked: false}, {name: 'milk', checked: false}], image: null, fileName: '' })
    const user = userEvent.setup()
    render(<App />)
    await confirmApiKey(user)
    await user.click(screen.getAllByRole('checkbox')[0])
    expect(screen.getAllByRole('checkbox')[0]).toBeChecked()
    expect(screen.getAllByRole('checkbox')[1]).not.toBeChecked()
  })

  it('does not rewrite a restored image when checking an item', async () => {
    const image = new Blob(['saved'], { type: 'image/png' })
    vi.mocked(loadSession).mockResolvedValue({ id: 'current', shoppingList: [{ name: 'milk', checked: false }], imageId: 'current', image, fileName: 'list.png' })
    const user = userEvent.setup()
    const { unmount } = render(<App />)
    await confirmApiKey(user)
    await user.click(screen.getByRole('checkbox'))
    await waitFor(() => expect(saveSession).toHaveBeenLastCalledWith({ id: 'current', shoppingList: [{ name: 'milk', checked: true }], imageId: 'current', fileName: 'list.png' }))
    expect(vi.mocked(saveSession).mock.calls.every(call => call.length === 1)).toBe(true)
    unmount()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview')
  })

  it('retries a failed image save with its Blob', async () => {
    const user = userEvent.setup()
    render(<App />)
    await confirmApiKey(user)
    vi.mocked(saveSession).mockRejectedValue(new DOMException('Full', 'QuotaExceededError'))
    const file = new File(['image'], 'list.png', { type: 'image/png' })
    await user.upload(document.querySelector('#upload') as HTMLInputElement, file)
    expect(await screen.findByRole('alert')).toHaveTextContent('Browser storage is full')
    vi.mocked(saveSession).mockResolvedValue(undefined)
    await user.click(screen.getByRole('button', { name: 'Retry save' }))
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
    expect(saveSession).toHaveBeenLastCalledWith(expect.objectContaining({ imageId: 'current' }), file)
    await user.click(getNavButton('Clear'))
    await waitFor(() => expect(saveSession).toHaveBeenLastCalledWith({ id: 'current', shoppingList: [], fileName: '' }, null))
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview')
  })

  it('stores the compressed Blob rather than the original photo', async () => {
    const compressed = new Blob(['small'], { type: 'image/jpeg' })
    vi.mocked(compressImage).mockResolvedValue(compressed)
    const user = userEvent.setup()
    render(<App />)
    await confirmApiKey(user)
    const file = new File(['large photo'], 'phone.png', { type: 'image/png' })
    await user.upload(document.querySelector('#upload') as HTMLInputElement, file)
    await waitFor(() => expect(saveSession).toHaveBeenLastCalledWith(expect.objectContaining({ fileName: 'phone.png' }), compressed))
    expect(compressImage).toHaveBeenCalledWith(file)
    const readAsDataURL = vi.spyOn(FileReader.prototype, 'readAsDataURL')
    await user.click(getNavButton('Process'))
    await waitFor(() => expect(recogniseHandwriting).toHaveBeenCalledOnce())
    expect(readAsDataURL).toHaveBeenCalledWith(file)
    expect(readAsDataURL).not.toHaveBeenCalledWith(compressed)
    readAsDataURL.mockRestore()
  })

  it('keeps the previous list and image if compression fails', async () => {
    const image = new Blob(['old'])
    vi.mocked(loadSession).mockResolvedValue({ id: 'current', shoppingList: [{ name: 'milk', checked: true }], imageId: 'current', image, fileName: 'old.png' })
    vi.mocked(compressImage).mockRejectedValue(new Error('Photo cannot be compressed'))
    const { toast } = await import('react-toastify')
    const user = userEvent.setup()
    render(<App />)
    await confirmApiKey(user)
    await user.upload(document.querySelector('#upload') as HTMLInputElement, new File(['bad'], 'new.png', { type: 'image/png' }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Photo cannot be compressed', expect.any(Object)))
    expect(screen.getByRole('checkbox')).toBeChecked()
    expect(screen.getByAltText('old.png')).toBeInTheDocument()
    expect(vi.mocked(saveSession).mock.calls.every(call => call.length === 1)).toBe(true)
  })

  it('restores processed results without re-running OCR after reload', async () => {
    vi.mocked(loadSession).mockResolvedValue({ id: 'current', shoppingList: [{ name: 'milk', checked: true }], imageId: 'current', image: new Blob(['saved']), fileName: 'list.jpg' })
    const user = userEvent.setup()
    const first = render(<App />)
    await confirmApiKey(user)
    first.unmount()
    render(<App />)
    await confirmApiKey(user)
    expect(screen.getByText('milk')).toBeInTheDocument()
    expect(screen.getByRole('checkbox')).toBeChecked()
    expect(getNavButton('Process')).toBeDisabled()
    expect(recogniseHandwriting).not.toHaveBeenCalled()
  })

  it.each([
    { hasImage: true, processed: false, warns: true },
    { hasImage: true, processed: true, warns: false },
    { hasImage: false, processed: false, warns: false },
  ])('warns before leaving only for unprocessed images after saving: %o', async ({ hasImage, processed, warns }) => {
    vi.mocked(loadSession).mockResolvedValue({
      id: 'current', shoppingList: processed ? [{ name: 'milk', checked: false }] : [],
      image: hasImage ? new Blob(['saved']) : null, fileName: '',
      ...(hasImage ? { imageId: 'current' as const } : {}),
    })
    await act(async () => { render(<App />) })
    const event = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(warns)
  })

})
