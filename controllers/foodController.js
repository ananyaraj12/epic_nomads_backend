import axios from "axios";

function toRad(value) {
  return (value * Math.PI) / 180;
}

function distanceInMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export const getFood = async (req, res) => {
  const { lat, lon } = req.query;

  try {
    const latNum = parseFloat(lat);
    const lonNum = parseFloat(lon);

    if (isNaN(latNum) || isNaN(lonNum)) {
      return res.status(400).json({ message: "lat and lon must be numbers" });
    }

    // bigger radius so we actually find stuff
    const radius = 7000;

    // more food categories
    const query = `
[out:json][timeout:25];
(
  nwr["amenity"~"restaurant|cafe|fast_food|food_court|ice_cream|pub|biergarten|bar|bakery"](around:${radius},${latNum},${lonNum});
);
out center 60;
`;

    const response = await axios.post(
      "https://overpass-api.de/api/interpreter",
      `data=${encodeURIComponent(query)}`,
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "EpicNomadsApp/1.0 (contact@epicnomads.com)",
        },
      }
    );

    const elements = response.data?.elements || [];
    console.log("Overpass returned elements:", elements.length);

    const places = elements
      .map((el) => {
        const tags = el.tags || {};
        const name = tags.name || "Unnamed place";
        const category = tags.amenity || "";
        const latPlace = el.lat || el.center?.lat;
        const lonPlace = el.lon || el.center?.lon;

        if (!latPlace || !lonPlace) return null;

        const addressParts = [
          tags["addr:housenumber"],
          tags["addr:street"],
          tags["addr:city"],
        ].filter(Boolean);

        const address = addressParts.join(", ");

        const distance = distanceInMeters(latNum, lonNum, latPlace, lonPlace);

        return {
          name,
          category,
          address,
          lat: latPlace,
          lon: lonPlace,
          distance,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 20);

    console.log("Food places found:", places.length);

    return res.status(200).json(places);
  } catch (err) {
    console.error("Overpass food error:", err.message);
    return res.status(500).json({ message: "Error fetching nearby food data" });
  }
};
