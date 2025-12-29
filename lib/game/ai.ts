import { Enemy, Entity, MapData, Position } from './types';
import { checkCollision } from './physics';
import { TILE_SIZE } from './map';

const ENEMY_SPEED = {
    'slime': 0.05,
    'bat': 0.08,
    'skeleton': 0.06,
    'boss': 0.07
};

export const updateEnemies = (enemies: Enemy[], player: Entity, map: MapData, deltaTime: number): Enemy[] => {
    return enemies.map(enemy => {
        // Simple state logic
        const dist = Math.sqrt(
            Math.pow(enemy.position.x - player.position.x, 2) + 
            Math.pow(enemy.position.y - player.position.y, 2)
        );

        let nextX = enemy.position.x;
        let nextY = enemy.position.y;
        let state = enemy.state;
        let direction = enemy.direction;

        // Detection
        if (dist < enemy.detectionRange && state === 'idle') {
            state = 'chase';
        } else if (dist > enemy.detectionRange * 1.5 && state === 'chase') {
            state = 'idle';
        }

        // Behavior
        if (state === 'chase') {
            const dx = player.position.x - enemy.position.x;
            const dy = player.position.y - enemy.position.y;
            const len = Math.sqrt(dx*dx + dy*dy);
            
            if (len > 0) {
                const speed = ENEMY_SPEED[enemy.type] * deltaTime;
                nextX += (dx / len) * speed;
                nextY += (dy / len) * speed;
                
                // Direction
                if (Math.abs(dx) > Math.abs(dy)) {
                    direction = dx > 0 ? 'right' : 'left';
                } else {
                    direction = dy > 0 ? 'down' : 'up';
                }
            }
        } else if (state === 'idle') {
            // Random wander?
            if (Math.random() < 0.01) {
                const dirs: ('up'|'down'|'left'|'right')[] = ['up', 'down', 'left', 'right'];
                direction = dirs[Math.floor(Math.random() * 4)];
            }
            if (Math.random() < 0.005) {
                // Short move
                const speed = ENEMY_SPEED[enemy.type] * deltaTime * 0.5;
                if (direction === 'up') nextY -= speed;
                if (direction === 'down') nextY += speed;
                if (direction === 'left') nextX -= speed;
                if (direction === 'right') nextX += speed;
            }
        }

        // Collision Check for Enemy
        // We use a simplified collision check for enemies to save perf? Or full check?
        // Let's do full check but with their own hitbox (usually smaller).
        
        let moved = false;
        if (!checkCollision({ x: nextX, y: enemy.position.y }, map)) {
            enemy.position.x = nextX;
            moved = true;
        }
        if (!checkCollision({ x: enemy.position.x, y: nextY }, map)) {
            enemy.position.y = nextY;
            moved = true;
        }

        enemy.isMoving = moved;
        enemy.direction = direction;
        enemy.state = state;

        return enemy;
    });
};

