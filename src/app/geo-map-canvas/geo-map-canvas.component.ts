import {Component, ElementRef, EventEmitter, HostListener, Input, OnInit, Output, ViewChild} from '@angular/core';
import {GeoMap} from '../domain/geo-map';
import {HotspotService} from '../hotspot.service';
import {HotspotList} from '../domain/hotspotlist';
import {Hotspot} from '../domain/hotspot';
import {BoundingBox} from '../domain/bounding-box';

@Component({
  selector: 'app-geo-map-canvas',
  templateUrl: './geo-map-canvas.component.html',
  styleUrls: ['./geo-map-canvas.component.css']
})




export class GeoMapCanvasComponent implements OnInit {
  BASE_HOTSPOT_FONT_SIZE = 24;
  BASE_TOWN_FONT_SIZE = 18;

  BASE_GUESS_FONT_SIZE = 30;

  private hotspotDefinition: string;
  private ctx: CanvasRenderingContext2D;
  private image: any;
  private paths: Map<string, Path2D> = new Map<string, Path2D>();
  private bboxes: Map<string, ClientRect> = new Map<string, ClientRect>();

  private hiddenNames = false;
  quizChecked = false;

  private hotspotList: HotspotList;
  private currentHotspot: string;
  private quizHotspots: string[] = [];


  private availableHotspots: string[] = [];
  private redHotspots: string[] = [];
  private selectedHotspots: string[] = [];

  private toguessHotspot: string;

  @Input('geoMap') geoMap: GeoMap;
  @Input('hotspotFile') hotspotFile: string;

  @ViewChild('canvas', {static: true})
  canvas: ElementRef<HTMLCanvasElement>;

  @Output() guess: EventEmitter<any> = new EventEmitter();

  constructor(
      private hotspotService: HotspotService
  ) { }

  ngOnInit() {
    this.ctx = this.canvas.nativeElement.getContext('2d');
    this.image = new Image();
    this.image.src = `assets/maps/${this.geoMap.dir}${this.geoMap.imgComp}`;
    this.loadHotspotsFromFile();
    this.loadImage();

  }

  getCurrentWidth(): number {
    const currentWidth = Math.min(this.geoMap.width, innerWidth);
    return currentWidth;
  }

  getScale():  number {
    const scale = this.getCurrentWidth() / this.geoMap.width;
    return scale;
  }

  getCurrentHeight(): number {
    return this.geoMap.height * this.getScale();
  }

  getFontSizeForHotspot(): number {
    let baseFontSize = this.BASE_HOTSPOT_FONT_SIZE;
    if (!(['countries', 'regions']).includes(this.hotspotFile)) {
      baseFontSize = this.BASE_TOWN_FONT_SIZE;
    }
    const realFontSize = Math.round(baseFontSize * this.getScale());
    return realFontSize;

  }

  getFontSizeForGuess(): number {
    const baseFontSize = this.BASE_GUESS_FONT_SIZE;
    const realFontSize = Math.round(baseFontSize * this.getScale());
    return realFontSize;

  }

  loadImage(): void {
    this.image.onload = () => {
      console.log(`loading Image: ${this.geoMap.name}`)
      this.ctx.drawImage(this.image, 0, 0, this.getCurrentWidth(), this.getCurrentHeight());
      if (Object.keys(this.paths).length === 0 || Object.keys(this.bboxes).length === 0) {
        this.loadHotspotsFromFile();
      }
      this.selectedHotspots = (this.quizChecked) ? this.quizHotspots : [this.currentHotspot];
      this.selectedHotspots.forEach((hotspot: string) => {
        if (hotspot) {
          const currentPath = this.paths.get(hotspot);
          this.ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
          this.ctx.fill(currentPath);
          if (this.hiddenNames) {
            this.writeCurrentHotspotName(hotspot);
          }
        }
      });
      if (this.quizChecked && this.toguessHotspot) {
        this.writeToGuessHotspot();
      }
    };
  }

  loadHotspotsFromFile(): void {
    const currentGeoMap = this;
    currentGeoMap.hotspotService.getHotspotDefinition(this.geoMap, this.hotspotFile).subscribe(
        function (hotspotDefinition) {
          currentGeoMap.hotspotDefinition = hotspotDefinition;
          currentGeoMap.hotspotList = currentGeoMap.hotspotService.getHotspotList(currentGeoMap.hotspotDefinition);
          currentGeoMap.loadHotspotsInCanvas();
        }
    );
  }


  toggleQuizChecked(): boolean {
    this.quizChecked = !this.quizChecked;
    this.hiddenNames = !this.hiddenNames;
    this.currentHotspot = undefined;
    this.quizHotspots = [];
    return this.quizChecked;
  }

  startQuiz(): string {
    this.currentHotspot = undefined;
    this.quizHotspots = [];
    const hotspot = this.findHotspotNotSelected();
    return hotspot;
  }

  writeToGuessHotspot(): void {
    this.ctx.fillStyle = this.geoMap.hotspotColor;

    this.ctx.font = `${this.getFontSizeForGuess()}px Verdana`;

    this.ctx.textBaseline = "top";
    this.ctx.textAlign = "left";
    this.ctx.fillText(this.toguessHotspot.toUpperCase(), this.geoMap.hotspotLocations[0][0] , this.geoMap.hotspotLocations[0][1] );
    this.ctx.fillText(this.toguessHotspot.toUpperCase(), this.geoMap.hotspotLocations[1][0] , this.geoMap.hotspotLocations[1][1] );
  }

  writeCurrentHotspotName(hotspot: string): void {
    if (hotspot) {
      this.ctx.font = `${this.getFontSizeForHotspot()}px Verdana`;
      //const bwidth = this.ctx.measureText(hotspot).width;
      const bwidth = 0;

      this.ctx.fillStyle = this.redHotspots.includes(hotspot) ? 'red' : this.geoMap.hotspotColor;
      const currentBoundingBox = this.bboxes.get(hotspot);

      const centerVerticalBoundingBox = (currentBoundingBox.bottom - currentBoundingBox.top) / 2 + currentBoundingBox.top;
      const centerHorizontalBoundingBox = (currentBoundingBox.right - currentBoundingBox.left) / 2 + currentBoundingBox.left;

      this.ctx.textBaseline = "top";
      this.ctx.textAlign = "center";

      this.ctx.fillText(hotspot, centerHorizontalBoundingBox, centerVerticalBoundingBox);
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    }
  }

  updateImageSrc() {
    console.log(`updateImageSrc: hiddenNames = ${this.hiddenNames}`);

    const current_img = this.hiddenNames ? this.geoMap.imgEmpty : this.geoMap.imgComp;
    this.image.src = `assets/maps/${this.geoMap.dir}${current_img}`;
  }

  loadHotspotsInCanvas() {
    const min = Math.min;
    const max = Math.max;
    const scale = this.getScale();
    for (const obj of this.hotspotList.hotspots) {
      const hotspot: Hotspot = <Hotspot>obj;


      const name = hotspot.hotspotName;
      if (hotspot.getShape() === 'circle') {
        const [centerX, centerY, radius] = hotspot.getCoords(scale)[0];

        this.ctx.beginPath();
        this.paths.set(name, new Path2D());
        this.paths.get(name).arc(centerX, centerY, radius, 0, 2 * Math.PI, false);
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        this.ctx.closePath();
        this.bboxes.set(name, new BoundingBox(centerX - radius, centerY - radius, centerX + radius, centerY + radius ));
      } else {
        const all_coords = hotspot.getCoords(scale);
        let minX = 0, minY = 0, maxX = this.image.width, maxY = this.image.height;
        this.ctx.beginPath();
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        this.paths.set(name, new Path2D());
        all_coords.forEach( (coord, index) => {
          const [x, y] = coord;
          minX = max(minX, x), minY = max(minY, y), maxX = min(maxX, x), maxY = min(maxY, y);
          if (index === 0) {
            this.paths.get(name).moveTo(x, y);
          } else {
            this.paths.get(name).lineTo(x, y);
          }
        });
        this.paths.get(name).lineTo(all_coords[0][0], all_coords[0][1]);
        this.ctx.closePath();
        this.bboxes.set(name, new BoundingBox(minX, minY, maxX, maxY));
      }
      this.availableHotspots.push(name);
    }
  }

  @HostListener('mousedown', ['$event'])
  onMouseDown(event) {
    const rect = event.target.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    this.redHotspots = [];
    this.selectedHotspots = [];

    this.paths.forEach((path: Path2D, key: string) => {
      if (this.ctx.isPointInPath(path, x, y, 'evenodd')) {
        if (this.quizChecked) {
          if (this.quizHotspots.includes(key)) {
            const found_index = this.quizHotspots.indexOf(key);
            this.quizHotspots.splice(found_index, 1);
          } else {
            this.quizHotspots.push(key);
            console.log(`Emitting : ${key}`);
            if (key !== this.toguessHotspot) {
              this.redHotspots.push(key);
            }
            this.guess.emit(key);

          }
        } else {
          if (this.currentHotspot === key) {
            this.currentHotspot = undefined;
          } else {
            this.currentHotspot = key;
          }
        }

      }
    });
    this.updateImageSrc();
  }

  giveup() {
    if (this.toguessHotspot) {
      this.quizHotspots.push(this.toguessHotspot);
    }
    this.updateImageSrc();
    this.guess.emit(this.toguessHotspot);
  }

  removeHotspot(key: string) {
    if (this.quizChecked) {
      if (this.quizHotspots.includes(key)) {
        const found_index = this.quizHotspots.indexOf(key);
        this.quizHotspots.splice(found_index, 1);
      }
    }
    this.updateImageSrc();
  }

  findHotspotNotSelected(): string {
    const candidateHotspots = this.availableHotspots.filter(x => !this.quizHotspots.includes(x));
    if (candidateHotspots.length > 0) {
      this.toguessHotspot = candidateHotspots[Math.floor(Math.random() * candidateHotspots.length)];
    } else {
      this.toguessHotspot = '';
    }
    return this.toguessHotspot;
  }

}
