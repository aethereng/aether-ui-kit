/* The shared public texts of an assistant panel: the fixed line under every answer, the line on every
 * proposal card, and the terms line. Each is a function, because the words that name the app differ
 * between apps: the noun for the surface the person works on, the subject the panel shows, the verb
 * a proposal takes, and whether the app keeps a record. Framework-free. */

const TEXT_TAG = 'a source tag'

/** Under every assistant answer. `subject` is the noun phrase the panel shows with an article, such
 *  as "a number" (a panel that shows no verdicts) or "a number or a verdict". `unlabelled` is the
 *  clause for a value without a tag; it defaults to "<subject> without one", which is the wording of
 *  a panel that shows numbers only. */
export function fixedLine(noun: string, subject: string, unlabelled: string = `${subject} without one`): string {
  const Subject = subject.charAt(0).toUpperCase() + subject.slice(1)
  return (
    `Words by the assistant. ${Subject} with ${TEXT_TAG} is shown by the ${noun} from the source its tag names; ` +
    `${unlabelled} was typed by the assistant. The assistant signs nothing. Not attested or warranted by Aether Engineering.`
  )
}

/** On every proposal card. `verb` is how the app's proposal takes effect, as in "Nothing is loaded
 *  until you accept." or "Nothing is changed until you accept.". */
export function proposalLine(verb: string): string {
  return `Nothing is ${verb} until you accept.`
}

/** In the panel's About text. The last sentence names the app's record file, so it is present only
 *  when the app keeps one. */
export function termsLine({ record }: { record: boolean }): string {
  const statement =
    "The assistant's text is not Aether Engineering's statement. It is neither attested nor warranted and carries no mark."
  return record ? `${statement} The record file is yours.` : statement
}
