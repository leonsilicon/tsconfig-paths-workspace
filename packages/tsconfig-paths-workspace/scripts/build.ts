import * as execa from 'execa';
import { chProjectDir, copyPackageFiles, rmDist } from 'lionconfig';

chProjectDir(import.meta.url);
rmDist();
execa.commandSync('tsc');
execa.commandSync('tsc-alias');
void copyPackageFiles({ commonjs: false });
