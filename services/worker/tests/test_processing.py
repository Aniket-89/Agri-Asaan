"""Index maths, cloud masking and per-pixel processing (no network)."""

import numpy as np
import pytest
from shapely.geometry import Polygon, box

from satellite.indices import ndmi, ndre, ndvi, normalized_difference
from satellite.masking import clear_mask, field_sky
from satellite.processing.field_pass import Bands, pixel_boxes, process_pass

# A 6 x 6 grid of 10 m pixels in a projected CRS, origin (500000, 3000060).
TRANSFORM = (10.0, 0.0, 500000.0, 0.0, -10.0, 3000060.0)


def identity(xs: np.ndarray, ys: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    return xs, ys


def grid(value: float) -> np.ndarray:
    return np.full((6, 6), value, dtype=np.float64)


def bands(scl: np.ndarray | None = None, **overrides: np.ndarray) -> Bands:
    values = {
        "red": grid(0.05),
        "nir": grid(0.45),
        "rededge": grid(0.20),
        "swir": grid(0.25),
    }
    values.update(overrides)
    return Bands(
        scl=scl if scl is not None else np.full((6, 6), 4, dtype=np.uint8),
        transform=TRANSFORM,
        **values,
    )


# The middle 4 x 4 pixels.
FIELD = box(500010, 3000010, 500050, 3000050)


class TestIndices:
    def test_values(self) -> None:
        assert ndvi(np.array([0.05]), np.array([0.45]))[0] == pytest.approx(0.8)
        assert ndre(np.array([0.2]), np.array([0.45]))[0] == pytest.approx(0.3846, abs=1e-4)
        assert ndmi(np.array([0.45]), np.array([0.25]))[0] == pytest.approx(0.2857, abs=1e-4)

    def test_missing_and_zero_inputs_give_nan(self) -> None:
        result = normalized_difference(np.array([np.nan, 0.0]), np.array([0.3, 0.0]))
        assert np.isnan(result).all()

    def test_clipped_to_valid_range(self) -> None:
        # Negative reflectance can appear after the L2A offset.
        result = normalized_difference(np.array([0.5]), np.array([-0.4]))
        assert result[0] == 1.0


class TestMasking:
    def test_clear_classes(self) -> None:
        scl = np.array([0, 3, 4, 5, 6, 7, 8, 9, 10, 11])
        assert clear_mask(scl).tolist() == [False, False, True, True, True, True] + [False] * 4

    def test_quality_bands(self) -> None:
        inside = np.ones(100, dtype=bool)
        clear = np.ones(100, dtype=bool)
        assert field_sky(clear, inside).quality == "good"
        clear[:25] = False
        assert field_sky(clear, inside).quality == "partly_cloudy"
        assert field_sky(clear, inside).cloud_cover_pct == 25.0
        clear[:60] = False
        assert field_sky(clear, inside).quality == "cloudy"

    def test_cloud_outside_the_field_does_not_count(self) -> None:
        inside = np.array([True] * 10 + [False] * 90)
        clear = np.array([True] * 10 + [False] * 90)
        assert field_sky(clear, inside).cloud_cover_pct == 0.0

    def test_too_few_clear_pixels_is_cloudy(self) -> None:
        sky = field_sky(np.array([True, True, False]), np.ones(3, dtype=bool))
        assert sky.quality == "cloudy"


class TestPixelBoxes:
    def test_boxes_follow_the_grid(self) -> None:
        boxes = pixel_boxes((6, 6), TRANSFORM)
        assert boxes[0, 0].bounds == (500000.0, 3000050.0, 500010.0, 3000060.0)
        assert boxes[5, 5].area == pytest.approx(100.0)


class TestProcessPass:
    def test_clear_field_means_and_cells(self) -> None:
        result = process_pass(bands(), FIELD, identity)
        assert result.sky.quality == "good"
        assert result.means == {"ndvi": 0.8, "ndre": 0.385, "ndmi": 0.286}
        assert len(result.cells) == 16
        assert all(cell.ndvi == 0.8 for cell in result.cells)

    def test_cells_are_clipped_to_the_boundary(self) -> None:
        triangle = Polygon([(500010, 3000010), (500050, 3000010), (500010, 3000050)])
        result = process_pass(bands(), triangle, identity)
        area = sum(Polygon(cell.ring).area for cell in result.cells)
        assert area == pytest.approx(triangle.area)

    def test_cloudy_pixels_are_masked_but_kept_as_cells(self) -> None:
        scl = np.full((6, 6), 4, dtype=np.uint8)
        scl[1, 1:5] = 9  # one row of the field under cloud
        red = grid(0.05)
        red[1, 1:5] = 0.4  # bright cloud would drag NDVI down if counted
        result = process_pass(bands(scl=scl, red=red), FIELD, identity)
        assert result.sky.quality == "partly_cloudy"
        assert result.sky.cloud_cover_pct == 25.0
        assert result.means is not None
        assert result.means["ndvi"] == 0.8
        masked = [cell for cell in result.cells if cell.ndvi is None]
        assert len(masked) == 4

    def test_cloudy_pass_has_no_values_or_cells(self) -> None:
        result = process_pass(bands(scl=np.full((6, 6), 8, dtype=np.uint8)), FIELD, identity)
        assert result.sky.quality == "cloudy"
        assert result.means is None
        assert result.cells == []

    def test_no_data_pixels_count_as_not_clear(self) -> None:
        red = grid(np.nan)
        result = process_pass(bands(red=red), FIELD, identity)
        assert result.sky.quality == "cloudy"
