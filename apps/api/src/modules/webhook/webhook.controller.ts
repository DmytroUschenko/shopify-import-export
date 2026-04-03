import { Body, Controller, Headers, Param, Post } from '@nestjs/common';

@Controller('webhooks')
export class WebhookController {
  @Post(':topic')
  async receiveWebhook(
    @Param('topic') topic: string,
    @Headers('x-shopify-shop-domain') shopDomain: string | undefined,
    @Body() body: Record<string, unknown>
  ) {
    return {
      accepted: true,
      topic,
      shopDomain: shopDomain ?? null,
      payloadKeys: Object.keys(body ?? {}),
    };
  }
}
