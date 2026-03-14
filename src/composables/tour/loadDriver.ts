/** Lazily load driver.js and its CSS (shared across tour composables) */
let driverCssLoaded = false

export async function loadDriver() {
  const { driver } = await import('driver.js')
  if (!driverCssLoaded) {
    await import('driver.js/dist/driver.css')
    driverCssLoaded = true
  }
  return driver
}
