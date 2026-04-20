import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { createElement } from "react";
import App from "@/App";

describe("example", () => {
  it("should pass", () => {
    expect(true).toBe(true);
  });

  it("renders dashboard after login", async () => {
    window.localStorage.clear();

    render(createElement(App));

    fireEvent.change(screen.getByLabelText("Пароль"), {
      target: { value: "kamilla123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Войти/i }));

    expect(await screen.findByText(/Bismillah Planner/i)).toBeInTheDocument();
  });
});
