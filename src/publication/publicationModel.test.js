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
  const publication = createPublicationFromTemplate({
    template: {
      crosswordId: "TT-2026-0001"
    },
    publicUrl: "https://wordex.example/play/TT-2026-0001"
  });

  expect(publication).toEqual({
    publicationId: "TT-2026-0001",
    crosswordId: "TT-2026-0001",
    newspaper: "",
    group: "",
    publishDate: "",
    publishWeek: "",
    status: "published",
    url: "https://wordex.example/play/TT-2026-0001",
    statistics: {}
  });
});
