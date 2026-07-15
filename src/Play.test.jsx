import { render, screen, waitFor } from "@testing-library/react";
import Play from "./Play";
import { loadBackendTemplate } from "./template/templateApi";

jest.mock("react-router-dom", () => ({
  useParams: () => ({
    id: "missing-template"
  })
}), { virtual: true });

jest.mock("./template/templateApi", () => ({
  loadBackendTemplate: jest.fn()
}));

test("network/load failure produces the Public Play error state", async () => {
  loadBackendTemplate.mockRejectedValue(new Error("Template not found"));

  render(<Play />);

  expect(screen.getByText("Loading...")).toBeInTheDocument();

  await waitFor(() => {
    expect(
      screen.getByText("Could not load template: Template not found")
    ).toBeInTheDocument();
  });
});
