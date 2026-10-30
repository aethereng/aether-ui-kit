/* What a gallery of samples holds, and how its cards fall into sections. Framework-free, so the rule
 * is tested without a component; `controls/gallery` draws it. */

export interface GalleryFamily {
  id: string
  /** The section's heading. */
  title: string
  /** A line beside the heading. */
  line?: string
}

export interface GalleryItem {
  id: string
  /** The id of the family it sits under. An item whose family is not listed is not shown. */
  family: string
  title: string
  line?: string
  /** The picture's address, already the one for the theme in force. */
  picture?: string
  /** An SVG path drawn where a picture would go, for an item that has none. */
  icon?: string
  /** A line at the card's foot, so that the feet of a row line up. */
  foot?: string
  /** An SVG path drawn before the foot. */
  footIcon?: string
  /** Text beside the card's button, so it can be selected and read in full. */
  note?: { label: string; text: string }
}

export interface GallerySection extends GalleryFamily {
  /** Each item carries its place in the whole list, which the entrance animation staggers by. */
  items: (GalleryItem & { place: number })[]
}

/** The families in their order, each with its items, and none that would be empty. */
export function gallerySections(families: readonly GalleryFamily[], items: readonly GalleryItem[]): GallerySection[] {
  let place = 0
  return families
    .map((family) => ({
      ...family,
      items: items.filter((item) => item.family === family.id).map((item) => ({ ...item, place: place++ })),
    }))
    .filter((section) => section.items.length > 0)
}
