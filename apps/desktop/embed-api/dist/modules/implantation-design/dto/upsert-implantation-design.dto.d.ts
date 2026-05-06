import { PlacementItemDto } from "./placement-item.dto";
export declare class UpsertImplantationDesignDto {
    centerLat: number;
    centerLng: number;
    zoom: number;
    roofPolygonGeoJson?: string | null;
    panelProductId?: string | null;
    panelNameSnapshot?: string | null;
    panelPowerWSnapshot?: number | null;
    panelWidthMmSnapshot?: number | null;
    panelLengthMmSnapshot?: number | null;
    panelOrientationMode?: "VERTICAL" | "HORIZONTAL" | null;
    spacingHorizontalMm?: number | null;
    spacingVerticalMm?: number | null;
    placements: PlacementItemDto[];
}
