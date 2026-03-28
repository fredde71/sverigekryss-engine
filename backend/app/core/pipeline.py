from app.agents.layout_agent import LayoutAgent
from app.agents.grid_agent import GridAgent

class Pipeline:
    def __init__(self):
        self.layout_agent = LayoutAgent()
        self.grid_agent = GridAgent()

    def run(self, pdf):
        layout_data = self.layout_agent.verify(pdf)
        cells = self.grid_agent.extract_cells(pdf)

        return {
            "layout": layout_data,
            "cells": cells
        }
