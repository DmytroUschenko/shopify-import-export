import type { ConfigPathDefinition } from '../configuration/shop-config-registry.service';

export const EXPORT_CONFIG_PATHS = {
  ORDER_ENABLED:    'export/order/is_enabled',
  ORDER_API_NAME:   'export/order/api_name',
  ORDER_API_KEY:    'export/order/api_key',
  ORDER_API_SECRET: 'export/order/api_secret',
} as const;

export const EXPORT_CONFIG_DEFINITIONS: ConfigPathDefinition[] = [
  {
    path:         EXPORT_CONFIG_PATHS.ORDER_ENABLED,
    group:        'export/order',
    groupLabel:   'Order Export API',
    label:        'Enable',
    type:         'boolean',
    defaultValue: 'false',
    description:  'Enable order export to the external API',
  },
  {
    path:       EXPORT_CONFIG_PATHS.ORDER_API_NAME,
    group:      'export/order',
    groupLabel: 'Order Export API',
    label:      'API Name',
    type:       'string',
  },
  {
    path:       EXPORT_CONFIG_PATHS.ORDER_API_KEY,
    group:      'export/order',
    groupLabel: 'Order Export API',
    label:      'API Key',
    type:       'string',
  },
  {
    path:       EXPORT_CONFIG_PATHS.ORDER_API_SECRET,
    group:      'export/order',
    groupLabel: 'Order Export API',
    label:      'API Secret',
    type:       'password',
    writeOnly:  true,
    description: 'Leave blank to keep the existing secret unchanged',
  },
];
