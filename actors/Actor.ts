import { Page } from '@playwright/test';

export class Actor {
  private page: Page;
  public name: string;

  constructor(name: string, page: Page) {
    this.name = name;
    this.page = page;
  }

  // This allows the actor to execute an Action or Task (e.g., actor.attemptsTo(new DecodeVinTask()))
  async attemptsTo(activity: { performAs: (actor: Actor, ...args: any[]) => Promise<void> }, ...args: any[]) {
    await activity.performAs(this, ...args);
  }

  // This allows the actor to run a Question (e.g., actor.asks(new PageTitle()))
  async asks<T = any>(question: { answeredBy: (actor: Actor) => Promise<T> }): Promise<T> {
    return await question.answeredBy(this);
  }

  // Expose the page so Tasks/Actions can interact with it
  getPage(): Page {
    return this.page;
  }
}
