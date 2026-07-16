import { render, screen } from "@testing-library/react";
import TemplateCanvas from "./TemplateCanvas";

beforeEach(() => {
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    disconnect() {}
  };
});

afterEach(() => {
  delete global.ResizeObserver;
});

const baseTemplate = {
  imageSrc: "/grid.png"
};

test("renders full-canvas viewport by default", () => {
  render(<TemplateCanvas template={baseTemplate} />);

  const viewport = screen.getByTestId("template-canvas-viewport");
  const source = screen.getByTestId("template-canvas-source");

  expect(viewport).toHaveStyle({
    width: "1200px",
    height: "1200px",
    overflow: "hidden"
  });
  expect(source).toHaveStyle({
    width: "1200px",
    height: "1200px",
    transform: "translate(0px, 0px)"
  });
});

test("uses cropArea dimensions for the viewport", () => {
  render(
    <TemplateCanvas
      template={{
        ...baseTemplate,
        cropArea: {
          top: 100,
          left: 80,
          width: 900,
          height: 700
        }
      }}
    />
  );

  expect(screen.getByTestId("template-canvas-viewport")).toHaveStyle({
    width: "900px",
    height: "700px",
    overflow: "hidden"
  });
});

test("translates the internal source surface by cropArea offset", () => {
  render(
    <TemplateCanvas
      template={{
        ...baseTemplate,
        cropArea: {
          top: 100,
          left: 80,
          width: 900,
          height: 700
        }
      }}
    >
      <div data-testid="overlay">overlay</div>
    </TemplateCanvas>
  );

  expect(screen.getByTestId("template-canvas-source")).toHaveStyle({
    transform: "translate(-80px, -100px)"
  });
  expect(screen.getByTestId("overlay")).toBeInTheDocument();
});

test("responsive mode preserves cropped aspect ratio", () => {
  render(
    <TemplateCanvas
      responsive
      template={{
        ...baseTemplate,
        cropArea: {
          top: 100,
          left: 80,
          width: 900,
          height: 700
        }
      }}
    />
  );

  const wrapper = screen.getByTestId("template-canvas-responsive-wrapper");

  expect(wrapper.style.maxWidth).toBe("900px");
  expect(wrapper.style.aspectRatio).toBe("900 / 700");
});
