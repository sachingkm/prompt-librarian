import { describe, expect, it } from 'vitest'
import { stringifyPrompt } from './library'

describe('stringifyPrompt', () => {
  it('omits undefined frontmatter fields before YAML serialization', () => {
    const markdown = stringifyPrompt({
      folder: '03-Interview',
      filename: 'interview.md',
      frontmatter: {
        title: 'Interview prep',
        category: 'Interview',
        subcategory: undefined,
        tags: ['interview']
      },
      body: 'Body text'
    })

    expect(markdown).toContain('title: Interview prep')
    expect(markdown).toContain('category: Interview')
    expect(markdown).toContain('tags:')
    expect(markdown).toContain('Body text')
    expect(markdown).not.toContain('subcategory')
    expect(markdown).not.toContain('undefined')
  })
})
