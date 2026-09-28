import Phaser from 'phaser';
import { ABOVE_DEPTH } from '../../logic/world/depth';
import { isDebug } from '../debug';
import { Tank } from '../entities/Tank';
import { events } from '../events';
import { InputSystem } from '../systems/InputSystem';
import { ProjectileSystem } from '../systems/ProjectileSystem';
import { SceneKey } from './keys';

/** Longest step fed to pawns, so a tab-switch hitch doesn't launch the tank through a wall. */
const MAX_DT = 1 / 20;

/** Gameplay scene. M1: the hand-built test room (chunk streaming arrives in M2). */
export class WorldScene extends Phaser.Scene {
  private tank!: Tank;
  private inputSystem!: InputSystem;

  constructor() {
    super(SceneKey.World);
  }

  create(): void {
    const map = this.make.tilemap({ key: 'map_test_room' });
    const tiles = map.addTilesetImage('tiles_test', 'tiles_test');
    if (!tiles) throw new Error('Tileset tiles_test missing from map_test_room');
    map.createLayer('ground', tiles)?.setDepth(-2);
    map.createLayer('decor', tiles)?.setDepth(-1);
    map.createLayer('above', tiles)?.setDepth(ABOVE_DEPTH);
    const walls = map.createLayer('walls', tiles);
    if (!walls) throw new Error('map_test_room has no walls layer');
    walls.setDepth(-1).setCollisionByProperty({ solid: true });

    const spawn = map.findObject('objects', (o) => o.type === 'spawn' && o.name === 'start');
    const projectiles = new ProjectileSystem(this, walls);
    this.tank = new Tank(this, spawn?.x ?? 0, spawn?.y ?? 0, 'mk2', -Math.PI / 2, projectiles);
    this.physics.add.collider(this.tank, walls);

    const w = map.widthInPixels;
    const h = map.heightInPixels;
    this.physics.world.setBounds(0, 0, w, h);
    this.cameras.main.setBounds(0, 0, w, h).startFollow(this.tank, true, 0.15, 0.15);

    this.inputSystem = new InputSystem(this);

    if (this.sys.game.device.input.touch) this.scene.launch(SceneKey.TouchControls);
    if (isDebug()) {
      this.scene.launch(SceneKey.Debug);
      events.on('debug:toggleBodies', this.toggleBodies, this);
    }

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.inputSystem.destroy();
      events.off('debug:toggleBodies', this.toggleBodies, this);
      this.scene.stop(SceneKey.TouchControls);
      this.scene.stop(SceneKey.Debug);
    });
  }

  override update(_time: number, delta: number): void {
    const dt = Math.min(delta / 1000, MAX_DT);
    const cmd = this.inputSystem.update({
      x: this.tank.x,
      y: this.tank.y,
      turretAngle: this.tank.aim,
      dt,
    });
    this.tank.applyCommand(cmd, dt);

    if (isDebug())
      events.emit('debug:pawn', {
        x: this.tank.x,
        y: this.tank.y,
        heading: this.tank.heading,
        speed: this.tank.speed,
        turretAngle: this.tank.aim,
        device: this.inputSystem.active,
      });
  }

  private toggleBodies(): void {
    const world = this.physics.world;
    world.drawDebug = !world.drawDebug;
    if (world.drawDebug && !world.debugGraphic) world.createDebugGraphic();
    world.debugGraphic?.clear().setDepth(ABOVE_DEPTH + 1);
  }
}
