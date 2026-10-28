declare module "@3d-dice/dice-box-threejs" {
  type DiceBoxThemeConfig = {
    colorset?: string;
    texture?: string;
    material?: string;
  };

  type DiceBoxOptions = {
    assetPath?: string;
    framerate?: number;
    sounds?: boolean;
    volume?: number;
    shadows?: boolean;
    theme_surface?: string;
    theme_customColorset?: Record<string, unknown> | null;
    theme_colorset?: string;
    theme_texture?: string;
    theme_material?: string;
    gravity_multiplier?: number;
    light_intensity?: number;
    baseScale?: number;
    strength?: number;
    iterationLimit?: number;
    onRollComplete?: (result: unknown) => void;
  };

  export default class DiceBox {
    theme_customColorset: Record<string, unknown> | null;
    DiceFactory: {
      materials_cache: Record<string, unknown>;
      get(type: string): {
        font: string;
      };
    };

    constructor(selector: string, options?: DiceBoxOptions);
    initialize(): Promise<void>;
    loadTheme(config: DiceBoxThemeConfig): Promise<void>;
    roll(notation: string): Promise<unknown>;
    add(notation: string): Promise<unknown>;
    clearDice(): void;
  }
}
