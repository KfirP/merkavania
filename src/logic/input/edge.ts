/** Turns a held button into a one-frame "just pressed" signal. */
export class RisingEdge {
  private prev = false;

  update(down: boolean): boolean {
    const rose = down && !this.prev;
    this.prev = down;
    return rose;
  }
}
