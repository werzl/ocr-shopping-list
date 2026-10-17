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
  return screen.getByRole('button', { name: label }) as HTMLButtonElement
}

describe('App', () => {
  it('shows Frozen and Ready Meals category headings for ice and prepared food', async () => {
    vi.mocked(loadSession).mockResolvedValue({ id: 'current', categories: true, shoppingList: [
      { name: 'Pizza', checked: false }, { name: 'ICE', checked: false },
      { name: 'ready meal', checked: false },
    ], image: null, fileName: '' })
    const user = userEvent.setup()
    render(<App />)
    await confirmApiKey(user)
    expect(screen.getAllByRole('heading', { level: 4 }).map(heading => heading.textContent)).toEqual(['Frozen', 'Ready Meals'])
    expect(screen.getByRole('checkbox', { name: 'ICE' })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Pizza' })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'ready meal' })).toBeInTheDocument()
  })

  it('groups categories and keeps item actions attached to their original items', async () => {
    vi.mocked(loadSession).mockResolvedValue({ id: 'current', categories: true, shoppingList: [
      { name: 'beer', checked: false }, { name: 'lettuce', checked: false },
      { name: 'toothpaste', checked: true }, { name: 'tomato', checked: false },
    ], image: null, fileName: '' })
    const user = userEvent.setup()
    render(<App />)
    await confirmApiKey(user)
    expect(screen.getAllByRole('heading', { level: 4 }).map(heading => heading.textContent)).toEqual(['Veg', 'Toiletries', 'Alcohol'])
    expect(screen.getByRole('checkbox', { name: 'Categorise' })).toBeEnabled()
    await user.click(screen.getByRole('checkbox', { name: 'beer' }))
    expect(screen.getByRole('checkbox', { name: 'beer' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'lettuce' })).not.toBeChecked()
    await user.click(getNavButton('Edit'))
    await user.clear(screen.getByRole('textbox', { name: 'Item 1 name' }))
    await user.type(screen.getByRole('textbox', { name: 'Item 1 name' }), 'apple')
    await user.click(getNavButton('Save'))
    expect(screen.getByRole('heading', { name: 'Fruit & Veg' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Alcohol' })).not.toBeInTheDocument()
  })

  it('allows category changes after adding an item and saves the choice', async () => {
    const user = userEvent.setup()
    render(<App />)
    await confirmApiKey(user)
    const option = screen.getByRole('checkbox', { name: 'Categorise' })
    await user.click(option)
    await waitFor(() => expect(saveSession).toHaveBeenLastCalledWith(expect.objectContaining({ categories: true })))
    await user.click(screen.getByRole('button', { name: 'Add item' }))
    expect(option).toBeDisabled()
    await user.type(screen.getByRole('textbox', { name: 'New item name' }), 'mystery item')
    await user.click(screen.getByRole('button', { name: 'Confirm new item' }))
    expect(option).toBeEnabled()
    expect(screen.getByRole('heading', { name: 'Other' })).toBeInTheDocument()
    await user.click(option)
    expect(screen.queryByRole('heading', { name: 'Other' })).not.toBeInTheDocument()
    await waitFor(() => expect(saveSession).toHaveBeenLastCalledWith({ id: 'current', shoppingList: [{ name: 'mystery item', checked: false }], fileName: '' }))
    await user.click(option)
    expect(screen.getByRole('heading', { name: 'Other' })).toBeInTheDocument()
    await user.click(getNavButton('Clear'))
    expect(option).toBeEnabled()
    expect(screen.queryByRole('heading', { name: 'Other' })).not.toBeInTheDocument()
    await user.click(option)
    expect(option).not.toBeChecked()
    await waitFor(() => expect(saveSession).toHaveBeenLastCalledWith({ id: 'current', shoppingList: [], fileName: '' }))
  })

  it('toggles categorise for an existing list without changing items or checked states', async () => {
    const items = [{ name: 'beer', checked: true }, { name: 'apple', checked: false }, { name: 'beer', checked: false }]
    vi.mocked(loadSession).mockResolvedValue({ id: 'current', shoppingList: items, image: null, fileName: '' })
    const user = userEvent.setup()
    const first = render(<App />)
    await confirmApiKey(user)
    const option = screen.getByRole('checkbox', { name: 'Categorise' })
    const itemNames = () => screen.getAllByRole('checkbox', { name: /^(?!Categorise$).+/ }).map(input => input.getAttribute('aria-label'))
    expect(itemNames()).toEqual(['beer', 'apple', 'beer'])
    await user.click(option)
    expect(itemNames()).toEqual(['apple', 'beer', 'beer'])
    expect(screen.getAllByRole('heading', { level: 4 }).map(heading => heading.textContent)).toEqual(['Fruit & Veg', 'Alcohol'])
    expect(screen.getAllByRole('checkbox', { name: 'beer' })[0]).toBeChecked()
    expect(screen.getAllByRole('checkbox', { name: 'beer' })[1]).not.toBeChecked()
    await waitFor(() => expect(saveSession).toHaveBeenLastCalledWith(expect.objectContaining({ categories: true, shoppingList: items })))
    await user.click(option)
    expect(itemNames()).toEqual(['beer', 'apple', 'beer'])
    expect(screen.queryByRole('heading', { level: 4 })).not.toBeInTheDocument()
    expect(screen.getAllByRole('checkbox', { name: 'beer' })[0]).toBeChecked()
    expect(screen.getAllByRole('checkbox', { name: 'beer' })[1]).not.toBeChecked()
    await waitFor(() => expect(saveSession).toHaveBeenLastCalledWith({ id: 'current', shoppingList: items, fileName: '' }))
    const saved = vi.mocked(saveSession).mock.calls.at(-1)![0]
    first.unmount()
    vi.mocked(loadSession).mockResolvedValue({ ...saved, image: null })
    render(<App />)
    await confirmApiKey(user)
    expect(screen.getByRole('checkbox', { name: 'Categorise' })).not.toBeChecked()
    expect(itemNames()).toEqual(['beer', 'apple', 'beer'])
    await user.click(screen.getByRole('button', { name: 'Edit' }))
    expect(screen.getByRole('checkbox', { name: 'Categorise' })).toBeDisabled()
  })

  it('groups photo results when categories are enabled', async () => {
    mockFileReader()
    const user = userEvent.setup()
    render(<App />)
    await confirmApiKey(user)
    await user.click(screen.getByRole('checkbox', { name: 'Categorise' }))
    await user.upload(document.getElementById('upload') as HTMLInputElement, new File(['photo'], 'list.png', { type: 'image/png' }))
    expect(await screen.findByRole('heading', { name: 'Dairy' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Bakery' })).toBeInTheDocument()
    await user.click(getNavButton('Save'))
    await waitFor(() => expect(saveSession).toHaveBeenLastCalledWith(expect.objectContaining({ categories: true, shoppingList: [
      { name: 'milk', checked: false }, { name: 'bread', checked: false }, { name: 'eggs', checked: false },
    ] }), expect.any(Blob)))
  })

  it('keeps the original order without category headings when categories are off', async () => {
    vi.mocked(loadSession).mockResolvedValue({ id: 'current', shoppingList: [{ name: 'beer', checked: false }, { name: 'apple', checked: false }], image: null, fileName: '' })
    const user = userEvent.setup()
    render(<App />)
    await confirmApiKey(user)
    expect(screen.queryByRole('heading', { level: 4 })).not.toBeInTheDocument()
    expect(screen.getAllByRole('checkbox', { name: /beer|apple/ }).map(input => input.getAttribute('aria-label'))).toEqual(['beer', 'apple'])
  })

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
    expect(screen.getByText('Handy List')).toBeInTheDocument()
    expect(screen.getByText('Back')).toBeInTheDocument()
    expect(screen.getByText('Photo')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add list' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('List name')).not.toBeInTheDocument()
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
    expect(screen.getByRole('checkbox', { name: /^(?!Categorise$).+/ })).toBeChecked()
  })

  it('covers the list until image preparation and recognition finish', async () => {
    mockFileReader()
    let finishPreparation!: (image: Blob) => void
    let finishRecognition!: (items: string) => void
    vi.mocked(compressImage).mockReturnValue(new Promise(resolve => { finishPreparation = resolve }))
    recogniseHandwriting.mockReturnValueOnce(new Promise(resolve => { finishRecognition = resolve }))
    const user = userEvent.setup()
    render(<App />)
    await confirmApiKey(user)
    await user.click(screen.getByRole('button', { name: 'Edit' }))
    const file = new File(['photo'], 'list.png', { type: 'image/png' })
    await user.upload(document.querySelector('#upload') as HTMLInputElement, file)
    const list = screen.getByRole('region', { name: 'Shopping list' })
    expect(list).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByRole('status')).toHaveTextContent('Preparing image')
    expect(list.querySelector('.shopping-list')).toHaveAttribute('inert')
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    await act(async () => { finishPreparation(file) })
    expect(screen.getByRole('status')).toHaveTextContent('Processing image')
    await act(async () => { finishRecognition('milk') })
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(list).toHaveAttribute('aria-busy', 'false')
    expect(list.querySelector('.shopping-list')).not.toHaveAttribute('inert')
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
  })

  it('offers Photo beside Add item and starts a draft after selecting a photo', async () => {
    mockFileReader()
    const user = userEvent.setup()
    render(<App />)
    await confirmApiKey(user)
    const photo = screen.getByRole('button', { name: 'Photo' })
    expect(photo.parentElement).toBe(screen.getByRole('button', { name: 'Add item' }).parentElement)
    expect(photo.closest('nav')).toBeNull()
    expect(photo).toBeEnabled()
    await user.upload(document.querySelector('#upload') as HTMLInputElement, new File(['photo'], 'list.png', { type: 'image/png' }))
    await waitFor(() => expect(screen.getByLabelText('Item 1 name')).toHaveValue('milk'))
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
    expect(photo).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByAltText('list.png')).not.toBeInTheDocument()
    expect(photo).toBeEnabled()
  })

  it('processes an uploaded image into a shopping list', async () => {
    mockFileReader()
    const user = userEvent.setup()
    render(<App />)

    await confirmApiKey(user)

    const file = new File(['fake-image'], 'list.png', { type: 'image/png' })
    const input = document.querySelector('#upload') as HTMLInputElement
    await user.click(screen.getByRole('button', { name: 'Edit' }))
    await user.upload(input, file)

    await waitFor(() => {
      expect(document.querySelector('.uploaded-image')).toBeInTheDocument()
    })


    await waitFor(() => {
      expect(screen.getByLabelText('Item 1 name')).toHaveValue('milk')
      expect(screen.getByLabelText('Item 2 name')).toHaveValue('bread')
      expect(screen.getByLabelText('Item 3 name')).toHaveValue('eggs')
    })

    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(recogniseHandwriting).toHaveBeenCalledOnce()
    expect(vi.mocked(saveSession).mock.calls.filter(call => call[1] instanceof Blob)).toHaveLength(1)
    expect(saveSession).toHaveBeenCalledWith(expect.objectContaining({ imageId: 'current' }), file)
    await waitFor(() => expect(saveSession).toHaveBeenLastCalledWith(expect.objectContaining({
      shoppingList: [{ name: 'milk', checked: false }, { name: 'bread', checked: false }, { name: 'eggs', checked: false }],
      imageId: 'current',
      fileName: 'list.png',
    }), file))
  })

  it('shows a processing error toast when OCR fails', async () => {
    mockFileReader()
    const { toast } = await import('react-toastify')
    recogniseHandwriting.mockRejectedValueOnce(new Error('network failure'))

    const user = userEvent.setup()
    render(<App />)

    await confirmApiKey(user)

    const file = new File(['fake-image'], 'list.png', { type: 'image/png' })
    await user.click(screen.getByRole('button', { name: 'Edit' }))
    await user.upload(document.querySelector('#upload') as HTMLInputElement, file)


    await waitFor(() => expect(recogniseHandwriting).toHaveBeenCalledOnce())
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Processing error', expect.any(Object))
    })
  })

  it('toggles a shopping list item when checked', async () => {
    vi.mocked(loadSession).mockResolvedValue({ id: 'current', shoppingList: [{ name: 'milk', checked: false }], image: null, fileName: '' })

    const user = userEvent.setup()
    render(<App />)

    await confirmApiKey(user)

    const checkbox = screen.getByRole('checkbox', { name: /^(?!Categorise$).+/ })
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
    expect(screen.getByText('Handy List')).toBeInTheDocument()
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
    await user.click(screen.getAllByRole('checkbox', { name: /^(?!Categorise$).+/ })[0])
    expect(screen.getAllByRole('checkbox', { name: /^(?!Categorise$).+/ })[0]).toBeChecked()
    expect(screen.getAllByRole('checkbox', { name: /^(?!Categorise$).+/ })[1]).not.toBeChecked()
  })

  it('does not rewrite a restored image when checking an item', async () => {
    const image = new Blob(['saved'], { type: 'image/png' })
    vi.mocked(loadSession).mockResolvedValue({ id: 'current', shoppingList: [{ name: 'milk', checked: false }], imageId: 'current', image, fileName: 'list.png' })
    const user = userEvent.setup()
    const { unmount } = render(<App />)
    await confirmApiKey(user)
    await user.click(screen.getByRole('checkbox', { name: /^(?!Categorise$).+/ }))
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
    mockFileReader()
    const file = new File(['image'], 'list.png', { type: 'image/png' })
    await user.click(screen.getByRole('button', { name: 'Edit' }))
    await user.upload(document.querySelector('#upload') as HTMLInputElement, file)
    await waitFor(() => expect(recogniseHandwriting).toHaveBeenCalledOnce())
    await user.click(screen.getByRole('button', { name: 'Save' }))
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
    mockFileReader()
    const compressed = new Blob(['small'], { type: 'image/jpeg' })
    vi.mocked(compressImage).mockResolvedValue(compressed)
    const user = userEvent.setup()
    render(<App />)
    await confirmApiKey(user)
    const file = new File(['large photo'], 'phone.png', { type: 'image/png' })
    await user.click(screen.getByRole('button', { name: 'Edit' }))
    await user.upload(document.querySelector('#upload') as HTMLInputElement, file)
    await waitFor(() => expect(recogniseHandwriting).toHaveBeenCalledOnce())
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(saveSession).toHaveBeenCalledWith(expect.objectContaining({ fileName: 'phone.png' }), compressed))
    expect(compressImage).toHaveBeenCalledWith(file)
    expect(recogniseHandwriting).toHaveBeenCalledWith('data:image/png;base64,fakeimagecontent')
  })

  it('keeps the source photo compact until the user expands it', async () => {
    vi.mocked(loadSession).mockResolvedValue({ id: 'current', shoppingList: [{ name: 'milk', checked: false }], image: new Blob(['photo']), fileName: 'list.png' })
    const user = userEvent.setup()
    render(<App />)
    await confirmApiKey(user)
    expect(screen.getByAltText('list.png')).toBeVisible()
    expect(screen.getByAltText('Full source photo')).not.toBeVisible()
    await user.click(screen.getByText('Uploaded photo'))
    expect(screen.getByAltText('Full source photo')).toBeVisible()
    await user.click(screen.getByText('Uploaded photo'))
    expect(screen.getByAltText('Full source photo')).not.toBeVisible()
  })

  it('blocks a second upload for a saved image', async () => {
    vi.mocked(loadSession).mockResolvedValue({ id: 'current', shoppingList: [], image: new Blob(['old']), fileName: 'old.png' })
    const user = userEvent.setup()
    render(<App />)
    await confirmApiKey(user)
    await user.click(screen.getByRole('button', { name: 'Edit' }))
    expect(screen.getByRole('button', { name: 'Photo' })).toBeDisabled()
    expect(document.querySelector('#upload')).toBeDisabled()
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
    expect(screen.getByRole('checkbox', { name: /^(?!Categorise$).+/ })).toBeChecked()
    expect(screen.getByRole('button', { name: 'Photo' })).toBeDisabled()
    expect(recogniseHandwriting).not.toHaveBeenCalled()
  })

  it.each([
    { hasImage: true, processed: false, warns: false },
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

  it('adds a new item directly while existing items stay outside edit mode', async () => {
    vi.mocked(loadSession).mockResolvedValue({ id: 'current', shoppingList: [{ name: 'milk', checked: true }], image: null, fileName: '' })
    const user = userEvent.setup()
    render(<App />)
    await confirmApiKey(user)
    await user.click(screen.getByRole('button', { name: 'Add item' }))
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'milk' })).toBeEnabled()
    expect(screen.queryByRole('button', { name: 'milk' })).not.toBeInTheDocument()
    await user.type(screen.getByLabelText('New item name'), 'milk')
    await user.click(screen.getByRole('button', { name: 'Confirm new item' }))
    expect(screen.getAllByRole('checkbox', { name: /^(?!Categorise$).+/ })).toHaveLength(2)
    await waitFor(() => expect(saveSession).toHaveBeenLastCalledWith(expect.objectContaining({ shoppingList: [{ name: 'milk', checked: true }, { name: 'milk', checked: false }] })))
    await user.click(screen.getByRole('button', { name: 'Edit' }))
    expect(screen.getAllByRole('textbox')).toHaveLength(2)
  })

  it('cancels a new item without adding a blank entry', async () => {
    const user = userEvent.setup()
    render(<App />)
    await confirmApiKey(user)
    await user.click(screen.getByRole('button', { name: 'Add item' }))
    expect(screen.getByRole('button', { name: 'Confirm new item' })).toBeDisabled()
    await user.type(screen.getByLabelText('New item name'), 'bread')
    await user.click(screen.getByRole('button', { name: 'Cancel new item' }))
    expect(screen.queryByLabelText('New item name')).not.toBeInTheDocument()
    expect(screen.queryByRole('checkbox', { name: /^(?!Categorise$).+/ })).not.toBeInTheDocument()
  })

  it('enables Edit only while the list contains items', async () => {
    const user = userEvent.setup()
    render(<App />)
    await confirmApiKey(user)
    expect(screen.getByRole('button', { name: 'Edit' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Add item' }))
    await user.type(screen.getByLabelText('New item name'), 'milk')
    await user.click(screen.getByRole('button', { name: 'Confirm new item' }))
    expect(screen.getByRole('button', { name: 'Edit' })).toBeEnabled()
    await user.click(screen.getByRole('button', { name: 'Clear' }))
    expect(screen.getByRole('button', { name: 'Edit' })).toBeDisabled()
  })

  it('creates and saves a manual list without an image', async () => {
    const user = userEvent.setup()
    render(<App />)
    await confirmApiKey(user)
    for (let index = 1; index <= 2; index++) {
      await user.click(screen.getByRole('button', { name: 'Add item' }))
      await user.type(screen.getByLabelText('New item name'), 'milk')
      await user.click(screen.getByRole('button', { name: 'Confirm new item' }))
    }
    expect(screen.getAllByRole('checkbox', { name: /^(?!Categorise$).+/ })).toHaveLength(2)
    await waitFor(() => expect(saveSession).toHaveBeenLastCalledWith(expect.objectContaining({ shoppingList: [{ name: 'milk', checked: false }, { name: 'milk', checked: false }] })))
    expect(recogniseHandwriting).not.toHaveBeenCalled()
  })

  it('removes an item in edit mode and saves only the remaining items', async () => {
    vi.mocked(loadSession).mockResolvedValue({ id: 'current', shoppingList: [{ name: 'milk', checked: true }, { name: 'milk', checked: false }], image: null, fileName: '' })
    const user = userEvent.setup()
    render(<App />)
    await confirmApiKey(user)
    await user.click(screen.getByRole('button', { name: 'Edit' }))
    await user.click(screen.getByRole('button', { name: 'Remove item 1' }))
    expect(screen.getAllByRole('textbox')).toHaveLength(1)
    expect(screen.getByLabelText('Item 1 name')).toHaveValue('milk')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByRole('checkbox', { name: 'milk' })).not.toBeChecked()
    await waitFor(() => expect(saveSession).toHaveBeenLastCalledWith(expect.objectContaining({ shoppingList: [{ name: 'milk', checked: false }] })))
  })

  it('restores removed items when the edit is cancelled', async () => {
    vi.mocked(loadSession).mockResolvedValue({ id: 'current', shoppingList: [{ name: 'milk', checked: true }], image: null, fileName: '' })
    const user = userEvent.setup()
    render(<App />)
    await confirmApiKey(user)
    await user.click(screen.getByRole('button', { name: 'Edit' }))
    await user.click(screen.getByRole('button', { name: 'Remove item 1' }))
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.getByRole('checkbox', { name: 'milk' })).toBeChecked()
  })

  it('cancels item edits without saving the draft', async () => {
    vi.mocked(loadSession).mockResolvedValue({ id: 'current', shoppingList: [{ name: 'milk', checked: true }], image: null, fileName: '' })
    const user = userEvent.setup()
    render(<App />)
    await confirmApiKey(user)
    await user.click(screen.getByRole('button', { name: 'Edit' }))
    await user.clear(screen.getByLabelText('Item 1 name'))
    await user.type(screen.getByLabelText('Item 1 name'), 'bread')
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.getByRole('heading', { name: /^HandyList/ })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'milk' })).toBeChecked()
    expect(vi.mocked(saveSession).mock.calls.some(call => call[0].shoppingList.some(item => item.name === 'bread'))).toBe(false)
  })

  it('appends image results after manual items and preserves duplicates', async () => {
    mockFileReader()
    vi.mocked(loadSession).mockResolvedValue({ id: 'current', shoppingList: [{ name: 'milk', checked: true }], image: null, fileName: '' })
    const user = userEvent.setup()
    render(<App />)
    await confirmApiKey(user)
    await user.click(screen.getByRole('button', { name: 'Edit' }))
    await user.upload(document.querySelector('#upload') as HTMLInputElement, new File(['photo'], 'list.png', { type: 'image/png' }))
    await waitFor(() => expect(screen.getAllByRole('textbox')).toHaveLength(4))
    expect(screen.getByRole('button', { name: 'Photo' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getAllByRole('checkbox', { name: /^(?!Categorise$).+/ }).map(input => input.getAttribute('aria-label'))).toEqual(['milk', 'milk', 'bread', 'eggs'])
    expect(screen.getAllByRole('checkbox', { name: /^(?!Categorise$).+/ })[0]).toBeChecked()
  })
})
