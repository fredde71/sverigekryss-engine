import {
  createPublication,
  createPublicationFromTemplate
} from "./publicationModel";

test("createPublication returns normalized Publication fields", () => {
  expect(createPublication({
    publicationId: " PUB-2026-0001 ",
    crosswordId: " TT-2026-0001 ",
    newspaper: " Dagens Kryss ",
    group: " Grupp A ",
    publishDate: " 2026-07-20 ",
    publishWeek: " 2026-W30 ",
    status: " published ",
    url: " https://example.com/play/TT-2026-0001 ",
    statistics: {
      views: 1
    }
  })).toEqual({
    publicationId: "PUB-2026-0001",
    crosswordId: "TT-2026-0001",
    newspaper: "Dagens Kryss",
    group: "Grupp A",
    publishDate: "2026-07-20",
    publishWeek: "2026-W30",
    status: "published",
    url: "https://example.com/play/TT-2026-0001",
    statistics: {
      views: 1
    }
  });
});

test("createPublication defaults optional fields safely", () => {
  expect(createPublication({
    publicationId: "PUB-2026-0001",
    crosswordId: "TT-2026-0001"
  })).toEqual({
    publicationId: "PUB-2026-0001",
    crosswordId: "TT-2026-0001",
    newspaper: "",
    group: "",
    publishDate: "",
    publishWeek: "",
    status: "draft",
    url: "",
    statistics: {}
  });
});

test("createPublicationFromTemplate builds the first editor Publication", () => {
  const gridArea = { top: 0, left: 0, width: 100, height: 100 };
  const template = {
    crosswordId: "TT-2026-0001",
    rows: 1,
    cols: 1,
    cellTypes: ["write"],
    documentSize: { width: 100, height: 100 },
    gridArea,
    imageSrc: ""
  };
  const publication = createPublicationFromTemplate({
    template,
    publicUrl: "https://wordex.example/play/TT-2026-0001"
  });

  expect(publication).toMatchObject({
    publicationId: "",
    crosswordId: "TT-2026-0001",
    newspaper: "",
    group: "",
    publishDate: "",
    publishWeek: "",
    status: "published",
    url: "https://wordex.example/play/TT-2026-0001",
    statistics: {},
    crosswordSnapshot: {
      type: "crossword-snapshot",
      version: 1,
      crosswordId: "TT-2026-0001",
      template: expect.objectContaining({
        crosswordId: "TT-2026-0001"
      })
    }
  });
  expect(Object.isFrozen(publication.crosswordSnapshot)).toBe(true);
  expect(Object.isFrozen(gridArea)).toBe(false);
  gridArea.width = 200;
  expect(publication.crosswordSnapshot.template.gridArea.width).toBe(100);
});

test("Publication snapshot must belong to the same crossword", () => {
  const snapshotPublication = createPublicationFromTemplate({
    template: {
      crosswordId: "TT-OTHER",
      rows: 1,
      cols: 1,
      cellTypes: ["write"],
      documentSize: { width: 100, height: 100 },
      gridArea: { top: 0, left: 0, width: 100, height: 100 },
      imageSrc: ""
    },
    publicUrl: "https://wordex.example/play/TT-OTHER"
  });

  expect(() => createPublication({
    ...snapshotPublication,
    crosswordId: "TT-DIFFERENT"
  })).toThrow("Publication snapshot crosswordId mismatch");
});
