import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'

const { recogniseHandwriting, testApiKey, OpenAiWrapperMock } = vi.hoisted(() => {
  const recogniseHandwriting = vi.fn()
  const testApiKey = vi.fn()
  const OpenAiWrapperMock = vi.fn().mockImplementation(() => ({
    recogniseHandwriting,
    testApiKey,
  }))

  return { recogniseHandwriting, testApiKey, OpenAiWrapperMock }
})

vi.mock('./openai/OpenAiWrapper', () => ({
  default: OpenAiWrapperMock,
}))

vi.mock('react-toastify', () => ({
  ToastContainer: () => null,
  toast: {
    error: vi.fn(),
  },
}))

vi.mock('./assets/arrow-left-solid-full.svg?react', () => ({
  default: () => <span>BackIcon</span>,
}))
vi.mock('./assets/photo-film-solid-full.svg?react', () => ({
  default: () => <span>PhotoIcon</span>,
}))
vi.mock('./assets/play-solid-full.svg?react', () => ({
  default: () => <span>PlayIcon</span>,
}))
vi.mock('./assets/trash-solid-full.svg?react', () => ({
  default: () => <span>TrashIcon</span>,
}))
vi.mock('./assets/pinch-to-zoom.svg?react', () => ({
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
    vi.unstubAllGlobals()
    testApiKey.mockResolvedValue([])
    recogniseHandwriting.mockResolvedValue('milk,bread,eggs')
  })

  it('shows the API key form by default', () => {
    render(<App />)

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

  it('restores a shopping list from localStorage after confirming a key', async () => {
    localStorage.setItem(
      'shoppingList',
      JSON.stringify([{ name: 'butter', checked: true }]),
    )

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
    expect(localStorage.getItem('shoppingList')).toContain('milk')
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
    localStorage.setItem(
      'shoppingList',
      JSON.stringify([{ name: 'milk', checked: false }]),
    )

    const user = userEvent.setup()
    render(<App />)

    await confirmApiKey(user)

    const checkbox = screen.getByRole('checkbox')
    await user.click(checkbox)

    expect(checkbox).toBeChecked()
    expect(JSON.parse(localStorage.getItem('shoppingList')!)).toEqual([
      { name: 'milk', checked: true },
    ])
  })

  it('clears the shopping list and image state', async () => {
    localStorage.setItem(
      'shoppingList',
      JSON.stringify([{ name: 'milk', checked: false }]),
    )
    localStorage.setItem('base64Image', 'data:image/png;base64,abc')

    const user = userEvent.setup()
    render(<App />)

    await confirmApiKey(user)

    expect(screen.getByText('milk')).toBeInTheDocument()

    await user.click(getNavButton('Clear'))

    expect(screen.queryByText('milk')).not.toBeInTheDocument()
    expect(screen.getByText('Upload an image')).toBeInTheDocument()
    expect(localStorage.getItem('shoppingList')).toBe('[]')
  })


  it('returns to the API key form when Back is pressed', async () => {
    const user = userEvent.setup()
    render(<App />)

    await confirmApiKey(user)

    await user.click(getNavButton('Back'))

    expect(screen.getByLabelText(/enter an api key/i)).toBeInTheDocument()
    expect(screen.queryByText('Process')).not.toBeInTheDocument()
  })
})
