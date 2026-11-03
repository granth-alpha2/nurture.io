"""Geographic and spatial calculation utilities for LandmarkNav Vision service."""

import math
from typing import List, Tuple

EARTH_RADIUS_METERS = 6371000.0
GEOHASH_BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz"


def haversine_distance_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate the great-circle distance between two points in meters."""
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (
        math.sin(delta_phi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return EARTH_RADIUS_METERS * c


def calculate_bearing_degrees(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate the forward azimuth / bearing from point 1 to point 2 in degrees [0, 360)."""
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_lambda = math.radians(lon2 - lon1)

    y = math.sin(delta_lambda) * math.cos(phi2)
    x = math.cos(phi1) * math.sin(phi2) - math.sin(phi1) * math.cos(phi2) * math.cos(delta_lambda)
    bearing = math.degrees(math.atan2(y, x))
    return (bearing + 360.0) % 360.0


def angular_difference_degrees(heading1: float, heading2: float) -> float:
    """Calculate the absolute minimal angular difference between two headings in degrees [0, 180]."""
    diff = abs(heading1 - heading2) % 360.0
    return 360.0 - diff if diff > 180.0 else diff


def is_within_heading_cone(
    user_lat: float,
    user_lon: float,
    user_heading_deg: float,
    target_lat: float,
    target_lon: float,
    cone_half_angle_deg: float = 60.0,
) -> bool:
    """Check if target is within the user's forward heading cone (default +/- 60 degrees)."""
    bearing_to_target = calculate_bearing_degrees(user_lat, user_lon, target_lat, target_lon)
    diff = angular_difference_degrees(user_heading_deg, bearing_to_target)
    return diff <= cone_half_angle_deg


def heading_to_bucket(heading_deg: float, num_buckets: int = 8) -> str:
    """Convert heading in degrees to a discrete directional bucket (e.g. 8 cardinal/intercardinal bins)."""
    bucket_size = 360.0 / num_buckets
    # Shift by half bucket so 0 deg is centered at 'N'
    index = int(((heading_deg + bucket_size / 2.0) % 360.0) // bucket_size)
    names = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]
    if num_buckets == 8:
        return names[index % 8]
    return f"b_{index}"


def encode_geohash(latitude: float, longitude: float, precision: int = 7) -> str:
    """Standard geohash encoder (precision 7 gives ~150m x 150m resolution)."""
    lat_interval = [-90.0, 90.0]
    lon_interval = [-180.0, 180.0]
    geohash = []
    bits = [16, 8, 4, 2, 1]
    bit = 0
    ch = 0
    even = True

    while len(geohash) < precision:
        if even:
            mid = (lon_interval[0] + lon_interval[1]) / 2.0
            if longitude >= mid:
                ch |= bits[bit]
                lon_interval[0] = mid
            else:
                lon_interval[1] = mid
        else:
            mid = (lat_interval[0] + lat_interval[1]) / 2.0
            if latitude >= mid:
                ch |= bits[bit]
                lat_interval[0] = mid
            else:
                lat_interval[1] = mid

        even = not even
        if bit < 4:
            bit += 1
        else:
            geohash.append(GEOHASH_BASE32[ch])
            bit = 0
            ch = 0

    return "".join(geohash)


def compute_corridor_tiles(
    polyline: List[Tuple[float, float]],
    precision: int = 7,
    buffer_steps: int = 1,
) -> List[str]:
    """Compute all unique tile keys (geohash or H3 equivalent) covering a walking route corridor."""
    unique_tiles = set()
    for lat, lon in polyline:
        center_hash = encode_geohash(lat, lon, precision)
        unique_tiles.add(center_hash)

        # Include adjacent sample points for corridor buffer
        delta = 0.0008  # ~90m
        for dlat in (-delta, 0.0, delta):
            for dlon in (-delta, 0.0, delta):
                unique_tiles.add(encode_geohash(lat + dlat, lon + dlon, precision))

    return sorted(list(unique_tiles))
