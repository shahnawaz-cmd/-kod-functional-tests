class ApiResponseCapture {
  constructor(page, timeout = 60000) {
    this.page = page;
    this.timeout = timeout;
    this.stripeResponses = [];
    this.paymentUpdateResponses = [];
    this.threeDSResponses = [];
  }

  async captureResponse(response) {
    const record = {
      url: response.url(),
      status: response.status(),
      ok: response.ok(),
    };

    try {
      const text = await response.text();
      record.body = text;

      try {
        record.json = JSON.parse(text);
      } catch (parseError) {
        record.parseError = parseError.message;
      }
    } catch (error) {
      record.error = error.message;
    }

    return record;
  }

  async waitForStripePaymentIntent() {
    const response = await this.page.waitForResponse(
      (response) => response.url().includes('https://api.stripe.com/v1/payment_intents'),
      { timeout: this.timeout }
    );
    const record = await this.captureResponse(response);
    this.stripeResponses.push(record);
    return record;
  }

  async waitForThreeDSAuthenticate() {
    const response = await this.page.waitForResponse(
      (response) => response.url().includes('https://api.stripe.com/v1/3ds2/authenticate'),
      { timeout: this.timeout }
    );
    const record = await this.captureResponse(response);
    this.threeDSResponses.push(record);
    return record;
  }

  async waitForStripeResponseByUrlPart(urlPart) {
    const response = await this.page.waitForResponse(
      (response) => response.url().includes(urlPart),
      { timeout: this.timeout }
    );
    const record = await this.captureResponse(response);
    this.stripeResponses.push(record);
    return record;
  }

  async waitForPaymentUpdate({ okOnly = true } = {}) {
    const response = await this.page.waitForResponse(
      (response) =>
        response.url().includes('/api-cwa/payment-update') && (!okOnly || response.ok()),
      { timeout: this.timeout }
    );
    const record = await this.captureResponse(response);
    this.paymentUpdateResponses.push(record);
    return record;
  }
}

class EUVinCapture extends ApiResponseCapture {
  async waitForVinCheckPreview() {
    const response = await this.page.waitForResponse(
      (response) => response.url().includes('vin-check/preview'),
      { timeout: this.timeout }
    );
    return await this.captureResponse(response);
  }
}

module.exports = { ApiResponseCapture, EUVinCapture };
