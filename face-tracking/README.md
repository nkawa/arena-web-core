# ARENA Face Detection and Tracking

## JSON format:

To get face data, subscribe to topic ```realm/s/<scene>/<id>/face```

```
{
    "object_id": "face_<camera id>",
    "hasFace": <bool>,                  # if there is a face detected/valid data.
    "face": {
        "flipped": <bool>,              # if image is flipped or not, can be set as URL param.
        "width": <src image width>,
        "height": <src image height>,
    },
    "pose": {
        "quaternions": [x, y, z, w],    # rotation in quaternions
        "translation": [x, y, z]        # may need to be scaled and adjusted. z = 0 is when your face is at the screen.
    },
    "landmarks": [x1, y1, x2, y2, ...], # flattened array of face landmarks as normalized points with image center as origin.
    "bbox": [x1, y1, x2, y2]            # (x1,y1) is upper left and (x2,y2) is lower right.
    "timestamp": <time>
}
```
## Landmark locations for reference
![landmarks](./readme/face_landmarks.jpg)

## URL params:

- trackface (bool)      - Enables face detection. Default is 0!
- debugFace (bool)      - Enables printing of JSON output and execution time for face detection, pose estimation, and MQTT pub + JSON creation.
- vidOff (bool)         - Removes live video window
- overlayOff (bool)     - Removes overlaying the face wire frame from the video window and the "initializing face detection" text.
- bboxOn (bool)         - Show the bbox in the video window.
- flipped (bool)        - Flip source image.
- frameSkip (int)       - How many frames should be skipped. default is 1 (no frames skipped).
- vidWidth (int)        - Sets the width of the video window in pixels, height is scaled by aspect ratio. The larger the width, the slower the face detection will take. Default is 320.

## Building:

Install emsdk, opencv, dlib. Download and activate emsdk and build WASM for opencv_js.

Run ```build.sh``` to build. Optional flag ```--force```.

## Citations:

C. Sagonas, E. Antonakos, G, Tzimiropoulos, S. Zafeiriou, M. Pantic. 300 faces In-the-wild challenge: Database and results. Image and Vision Computing (IMAVIS), Special Issue on Facial Landmark Localisation "In-The-Wild". 2016.

C. Sagonas, G. Tzimiropoulos, S. Zafeiriou, M. Pantic. A semi-automatic methodology for facial landmark annotation. Proceedings of IEEE Int’l Conf. Computer Vision and Pattern Recognition (CVPR-W), 5th Workshop on Analysis and Modeling of Faces and Gestures (AMFG 2013). Oregon, USA, June 2013.

C. Sagonas, G. Tzimiropoulos, S. Zafeiriou, M. Pantic. 300 Faces in-the-Wild Challenge: The first facial landmark localization Challenge. Proceedings of IEEE Int’l Conf. on Computer Vision (ICCV-W), 300 Faces in-the-Wild Challenge (300-W). Sydney, Australia, December 2013.

More info here: [https://ibug.doc.ic.ac.uk/resources/facial-point-annotations/](https://ibug.doc.ic.ac.uk/resources/facial-point-annotations/)