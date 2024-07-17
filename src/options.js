document.addEventListener("DOMContentLoaded", () => {
  const cameraPermissionButton = document.getElementById("requestPermission");

  cameraPermissionButton.addEventListener("click", () => {
    console.log("Requesting camera permission");
    navigator.mediaDevices
      .getUserMedia({ video: true })
      .then((stream) => {
        console.log("Camera permission granted");
        stream.getTracks().forEach((track) => track.stop());
      })
      .catch((err) => {
        console.error("The following error occurred: ", err.name);
      });
  });
});
