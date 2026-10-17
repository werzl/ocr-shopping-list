import { beforeEach, describe, expect, it, vi } from 'vitest'
import OpenAIWrapper from '../../src/openai/OpenAiWrapper'

const { createMock, listMock } = vi.hoisted(() => ({
  createMock: vi.fn(),
  listMock: vi.fn(),
}))

vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: createMock,
      },
    },
    models: {
      list: listMock,
    },
  })),
}))

describe('OpenAIWrapper', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('VITE_OpenAI_Api_Key', '')
  })

  it('throws when no API key is provided', () => {
    expect(() => new OpenAIWrapper()).toThrow('Api Key was not set')
  })

  it('accepts an API key via constructor', () => {
    expect(() => new OpenAIWrapper('sk-test')).not.toThrow()
  })

  it('returns handwriting text from the chat completion', async () => {
    createMock.mockResolvedValue({
      choices: [{ message: { content: 'milk,bread,eggs' } }],
    })

    const wrapper = new OpenAIWrapper('sk-test')
    const result = await wrapper.recogniseHandwriting('data:image/png;base64,abc')

    expect(result).toBe('milk,bread,eggs')
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gpt-4.1',
        messages: expect.arrayContaining([
          expect.objectContaining({ role: 'system' }),
          expect.objectContaining({ role: 'user' }),
        ]),
      }),
    )
  })

  it('returns an empty string when completion content is null', async () => {
    createMock.mockResolvedValue({
      choices: [{ message: { content: null } }],
    })

    const wrapper = new OpenAIWrapper('sk-test')
    const result = await wrapper.recogniseHandwriting('data:image/png;base64,abc')

    expect(result).toBe('')
  })

  it('lists models when testing the API key', async () => {
    listMock.mockResolvedValue({ data: [{ id: 'gpt-4.1' }] })

    const wrapper = new OpenAIWrapper('sk-test')
    const result = await wrapper.testApiKey()

    expect(result).toEqual([{ id: 'gpt-4.1' }])
    expect(listMock).toHaveBeenCalledOnce()
  })
})
