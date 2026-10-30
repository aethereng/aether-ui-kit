import { describe, expect, it } from 'vitest'
import { ARROW, CHOICE, NUMBER, PAD, TEXT_CEILING, choiceWidth, isCut, measurer, numberWidth } from '..'

const byLength = (text: string): number => text.length * 10

describe('the width of a column', () => {
  it('sizes a number column to its widest value with the padding, between its floor and its ceiling', () => {
    expect(numberWidth(['1', '12345'], byLength)).toBe(50 + PAD)
    expect(numberWidth(['1'], byLength)).toBe(NUMBER.floor)
    expect(numberWidth(['1'.repeat(40)], byLength)).toBe(NUMBER.ceiling)
    expect(numberWidth(['', ''], byLength)).toBe(NUMBER.floor)
    expect(numberWidth(['', '123456'], byLength)).toBe(60 + PAD)
  })

  it('sizes a choice column to its longest option with the padding and the arrow, between its floor and its ceiling', () => {
    expect(choiceWidth(['(none)', 'painted'], byLength)).toBe(70 + PAD + ARROW)
    expect(choiceWidth(['a'], byLength)).toBe(CHOICE.floor)
    expect(choiceWidth(['x'.repeat(30)], byLength)).toBe(CHOICE.ceiling)
    expect(TEXT_CEILING).toBeGreaterThan(0)
  })

  it('cuts a value only where it and the chrome are wider than its control', () => {
    expect(isCut('12345', 50 + PAD, PAD, byLength)).toBe(false)
    expect(isCut('123456', 50 + PAD, PAD, byLength)).toBe(true)
    expect(isCut('', 0, PAD, byLength)).toBe(false)
  })

  it('measures a character where nothing lays out as 8 px', () => {
    expect(measurer()('1234')).toBe(32)
  })
})
