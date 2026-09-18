import { fireEvent, render, screen } from "@testing-library/react";
import PublicationAccessLinks, {
  createPublicationAccessLinkViewModel
} from "./PublicationAccessLinks";

const HELP_TOKEN = "abcdefghijklmnopqrstuvwxyzABCDEFGH123456789";

beforeEach(() => {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: jest.fn().mockResolvedValue(undefined) }
  });
});

test("activated help publication exposes copyable solve and help links", () => {
  const publication = createPublication({
    solution: "AB",
    helpAccessToken: HELP_TOKEN,
    helpAccessStatus: "active"
  });

  render(<PublicationAccessLinks publication={publication} />);

  expect(screen.getByLabelText("Lösarlänk")).toHaveValue(
    "https://wordex.example/play/PUB-LINK-1"
  );
  expect(screen.getByLabelText("Facit-/hjälplänk")).toHaveValue(
    `https://wordex.example/play/PUB-LINK-1?helpAccessToken=${HELP_TOKEN}`
  );
  fireEvent.click(screen.getByRole("button", { name: "Kopiera facit-/hjälplänk" }));
  expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
    `https://wordex.example/play/PUB-LINK-1?helpAccessToken=${HELP_TOKEN}`
  );
});

test("incomplete publication exposes solve link and factual help reason", () => {
  const publication = createPublication({ solution: "A" });
  const viewModel = createPublicationAccessLinkViewModel(publication);

  render(<PublicationAccessLinks publication={publication} />);

  expect(screen.getByLabelText("Lösarlänk")).toBeInTheDocument();
  expect(screen.queryByLabelText("Facit-/hjälplänk")).not.toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveTextContent("komplett giltig lösning");
  expect(screen.getByRole("button", { name: "Publicera facit" })).toBeDisabled();
  expect(viewModel.helpUrl).toBe("");
});

test("complete inactive publication enables explicit facit publication", () => {
  const onPublishHelp = jest.fn();
  const publication = createPublication({
    solution: "AB",
    helpAccessToken: HELP_TOKEN,
    helpAccessStatus: "inactive"
  });

  render(
    <PublicationAccessLinks
      publication={publication}
      onPublishHelp={onPublishHelp}
    />
  );

  expect(screen.queryByLabelText("Facit-/hjälplänk")).not.toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveTextContent("ännu inte publicerat");
  fireEvent.click(screen.getByRole("button", { name: "Publicera facit" }));
  expect(onPublishHelp).toHaveBeenCalledTimes(1);
});

function createPublication({
  solution,
  helpAccessToken = "",
  helpAccessStatus = "inactive"
}) {
  return {
    publicationId: "PUB-LINK-1",
    crosswordId: "TT-LINK-1",
    url: "https://wordex.example/play/PUB-LINK-1",
    ...(helpAccessToken ? { helpAccessToken, helpAccessStatus } : {}),
    crosswordSnapshot: {
      type: "crossword-snapshot",
      version: 1,
      crosswordId: "TT-LINK-1",
      template: {
        crosswordId: "TT-LINK-1",
        crosswordType: "sverigekryss",
        rows: 1,
        cols: 3,
        cellTypes: ["blocked", "write", "write"],
        answerPaths: [{
          clueIndex: 0,
          paths: [{ direction: "across", cellIndexes: [1, 2], solution }]
        }]
      }
    }
  };
}
