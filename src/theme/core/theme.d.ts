export interface ThemeDef {
    dark: boolean;
    colors: Record<string, string>;
}
/** `#0E1338` -> `14,19,56`. Shorthand is expanded; anything not a hex is returned untouched, so a
 *  non-hex value a theme might carry cannot be mangled into a broken triple. */
export declare function hexToTriple(hex: string): string;
/**
 * The stylesheet text for a set of themes, one block per theme, each role as
 * `--<prefix>-<role>`. ONE SELECTOR, `[data-theme='<name>']`, which the controller sets on the
 * document root.
 */
export declare function cssTokens(themes: Record<string, ThemeDef>, prefix: string): string;
export interface ThemeOptions {
    themes: Record<string, ThemeDef>;
    /** The name of the dark theme among `themes`. */
    dark: string;
    /** The name of the light theme among `themes`. */
    light: string;
    /** The localStorage key the reader's choice is kept under. Own key per app: two apps served
     *  from one origin share its storage. */
    storageKey: string;
    /** The custom properties' prefix: `q` gives `--q-surface`. */
    prefix: string;
    /** Paper is light: while the page prints, the document wears the light theme. Default true. */
    paper?: boolean;
}
export interface ThemeController {
    /** The active theme's name: the `dark` or the `light` name the controller was given. */
    readonly name: string;
    readonly isDark: boolean;
    /** The active palette, for what cannot read CSS (a WebGL scene). */
    readonly colors: Record<string, string>;
    /** Turns dark to light or light to dark, and keeps the choice. */
    toggle(): void;
    /** Calls `listener` with the new name after every toggle; gives back the call that stops it. */
    subscribe(listener: (name: string) => void): () => void;
}
/**
 * Owns which theme is on, and puts its tokens on the page.
 *
 * BEFORE FIRST PAINT, deliberately. Called at module scope, this puts the tokens and `data-theme`
 * on the document before anything mounts. A theme applied after mount once left a control holding
 * the outgoing palette for good: a `transition` on a token-coloured background started before the
 * element had settled and committed its start value. The cheap defence is to never paint the
 * wrong palette in the first place.
 *
 * Without a document (a server render, a node test) it reads the same and touches nothing.
 */
export declare function createThemeController(options: ThemeOptions): ThemeController;
