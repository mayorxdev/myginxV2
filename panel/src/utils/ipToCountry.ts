export const getCountryCode = async (ip: string) => {
  try {
    const response = await fetch(
      `https://api.ipapi.com/${ip}?access_key=0c926376087e87368b120334841f963b&fields=country_code`
    );

    if (!response.ok) throw new Error("API error");
    const data = await response.json();
    return data.country_code?.toUpperCase() || "US";
  } catch (error) {
    console.error("Error:", error);
    return "US";
  }
};
