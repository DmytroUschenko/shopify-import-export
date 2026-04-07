import { Injectable } from '@nestjs/common';

export interface ConfigPathDefinition {
  path: string;
  group: string;
  groupLabel: string;
  label: string;
  type: 'string' | 'boolean' | 'password';
  defaultValue?: string;
  description?: string;
  /** Never returned as a value in GET responses */
  writeOnly?: boolean;
}

export interface GroupedConfigDefinition {
  group: string;
  label: string;
  items: ConfigPathDefinition[];
}

@Injectable()
export class ShopConfigRegistry {
  private readonly definitions = new Map<string, ConfigPathDefinition>();

  register(defs: ConfigPathDefinition[]): void {
    defs.forEach((d) => this.definitions.set(d.path, d));
  }

  getDefinition(path: string): ConfigPathDefinition | undefined {
    return this.definitions.get(path);
  }

  getDefault(path: string): string | undefined {
    return this.definitions.get(path)?.defaultValue;
  }

  isDefined(path: string): boolean {
    return this.definitions.has(path);
  }

  getAllDefinitions(): ConfigPathDefinition[] {
    return Array.from(this.definitions.values());
  }

  getGroupedDefinitions(): GroupedConfigDefinition[] {
    const groupMap = new Map<string, GroupedConfigDefinition>();

    for (const def of this.definitions.values()) {
      if (!groupMap.has(def.group)) {
        groupMap.set(def.group, { group: def.group, label: def.groupLabel, items: [] });
      }
      groupMap.get(def.group)!.items.push(def);
    }

    return Array.from(groupMap.values());
  }
}
