# Changelog

A release is a tag, and a tag is never moved. Each entry names what a consumer of that tag sees. Releases before 0.28.0 are
described by their tag messages (`git tag -n`).

## Unreleased

- **Disclosure**: the header states `box-sizing: border-box` itself. Its 44px height on a coarse pointer counts the header's padding
  only under border-box, so an app whose reset is content-box drew it 64px. It now draws 44px under either reset.

## 0.28.0

A control that a parent refuses a change to now shows what the parent holds, a field commits on Enter or on leaving it, and four more
controls take `disabled`.

### A refused change is not left on screen

- **Switch** (50c76f1), **Select** and **Slider** (7738c84): the native control is set back to `modelValue` once the parent has
  answered, and keeps focus. Before, a parent that refused a change, or answered with the value it already held, left the control
  drawn on the value it declined. A Slider that only snapped a stored value to its step is not rewritten.
- **TextField** and **NumberField** (c64d366): the box commits on Enter or on leaving it. While the user types nothing moves under the
  caret. On Enter or blur the box is set back to `modelValue` once the parent has answered. A textarea commits on leaving only, since
  Enter is a new line there, and an Enter that confirms an IME candidate is not a commit. NumberField also draws the held number over
  an unfinished one such as `1.`.
- **RecordTable** (c64d366): the table drew the typed text as its fields' model and nothing after a commit, so a field would have put
  that text back. It now draws once when what is held is let go (commit, leave, Escape), and still draws nothing per key.
- **RadioGroup** (6e8a680): an arrow key that lands on an option the parent refuses leaves focus on the checked option. With nothing
  checked, focus goes to the option the arrow landed on.
- **Checkbox** and **RadioGroup** (50c76f1): draw from their props alone and needed no repair. Tests with a refusing parent and an
  accepting one now pin that.

### Disabled

- **DateField**, **SearchField**, **Transport**, **ChatPanel** (114806c): a new `disabled` prop. Each is dimmed by the opacity Switch
  declares, has nothing focusable in it, and sends no event. DateField closes a picker that is open when it turns disabled. Transport
  dims the bar once, and a drag already begun still ends with `scrub-end`. ChatPanel disables the compose box and the three buttons it
  draws, leaves the log readable, and leaves its `actions` slot to the caller.
- **Select** and **NumberField** (8e3931d): a disabled one is dimmed as the other disabled controls are. Before, Select set only the
  cursor and NumberField had no rule, so both looked live. In the `base-select` popup a disabled row takes Menu's disabled ink and does
  not light under the pointer.
- **TextField** (652ed21): a disabled box is dimmed like the others and keeps its ink. Before, its text was greyed to the ink of a
  placeholder, so a locked value read as an empty field.

### Touch

- **Tool**, **Disclosure**, **FilterRail**, **Transport** (c1a3ed7): on a coarse pointer the 44px tap area is a `::before` past the
  box, or the header row itself for Disclosure, so each draws as tall as it does on a mouse. Transport's scrub keeps its 44px box with a
  margin that cancels it. Inputs and selects keep their 44px floor.

### Maintenance

- A comment on Select's disabled rule says what the dimming does (de2a71c). A copy pass on the new `disabled` comments (de1d819).
