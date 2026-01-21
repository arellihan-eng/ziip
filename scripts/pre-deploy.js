#!/usr/bin/env node

/**
 * Pre-deploy checklist - run before pushing to production
 * Usage: npm run pre-deploy
 */

const { execSync } = require('child_process');

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

console.log('\n========================================');
console.log('  ZIIP Pre-Deploy Checklist');
console.log('========================================\n');

let hasIssues = false;
let warnings = [];
let errors = [];

// 1. Check for uncommitted changes
try {
  const status = execSync('git status --porcelain', { encoding: 'utf8' });

  if (status.trim()) {
    const lines = status.trim().split('\n');
    const modified = lines.filter(l => l.startsWith(' M') || l.startsWith('M '));
    const untracked = lines.filter(l => l.startsWith('??'));
    const staged = lines.filter(l => l.startsWith('A ') || l.startsWith('M '));

    if (modified.length > 0) {
      errors.push(`${modified.length} file(s) modified but NOT staged for commit:`);
      modified.forEach(f => errors.push(`   ${f.slice(3)}`));
      hasIssues = true;
    }

    if (untracked.length > 0) {
      // Check for important untracked files
      const important = untracked.filter(f =>
        f.includes('/api/') ||
        f.includes('.jsx') ||
        f.includes('.js') && !f.includes('node_modules')
      );

      if (important.length > 0) {
        errors.push(`${important.length} important file(s) NOT tracked by git:`);
        important.forEach(f => errors.push(`   ${f.slice(3)}`));
        hasIssues = true;
      } else if (untracked.length > 0) {
        warnings.push(`${untracked.length} untracked file(s) (probably fine)`);
      }
    }

    if (staged.length > 0) {
      warnings.push(`${staged.length} file(s) staged but not committed yet`);
    }
  }
} catch (e) {
  errors.push('Could not check git status');
}

// 2. Check if we're ahead/behind remote
try {
  execSync('git fetch origin main --quiet', { encoding: 'utf8' });
  const status = execSync('git status -sb', { encoding: 'utf8' });

  if (status.includes('ahead')) {
    const match = status.match(/ahead (\d+)/);
    warnings.push(`You have ${match ? match[1] : 'some'} commit(s) not pushed yet`);
  }

  if (status.includes('behind')) {
    const match = status.match(/behind (\d+)/);
    errors.push(`You are ${match ? match[1] : 'some'} commit(s) behind remote - pull first!`);
    hasIssues = true;
  }
} catch (e) {
  warnings.push('Could not check remote status');
}

// 3. Check that critical files exist in git
const criticalFiles = ['api/claude.js', 'src/lib/claude-sql.js', 'src/hooks/useAuth.jsx'];
try {
  const trackedFiles = execSync('git ls-files', { encoding: 'utf8' });
  criticalFiles.forEach(file => {
    if (!trackedFiles.includes(file)) {
      errors.push(`Critical file NOT in git: ${file}`);
      hasIssues = true;
    }
  });
} catch (e) {
  warnings.push('Could not verify critical files');
}

// 4. Check that .env files aren't being committed
try {
  const trackedFiles = execSync('git ls-files', { encoding: 'utf8' });
  if (trackedFiles.includes('.env.local') || trackedFiles.includes('.env')) {
    errors.push('WARNING: .env file is tracked by git - secrets may be exposed!');
    hasIssues = true;
  }
} catch (e) {}

// Print results
console.log('RESULTS:\n');

if (errors.length > 0) {
  console.log(`${RED}ERRORS (must fix before deploy):${RESET}`);
  errors.forEach(e => console.log(`${RED}  - ${e}${RESET}`));
  console.log('');
}

if (warnings.length > 0) {
  console.log(`${YELLOW}WARNINGS (review these):${RESET}`);
  warnings.forEach(w => console.log(`${YELLOW}  - ${w}${RESET}`));
  console.log('');
}

if (!hasIssues && warnings.length === 0) {
  console.log(`${GREEN}All checks passed! Safe to deploy.${RESET}\n`);
}

if (hasIssues) {
  console.log('----------------------------------------');
  console.log(`${RED}FIX THE ERRORS ABOVE BEFORE DEPLOYING${RESET}`);
  console.log('----------------------------------------');
  console.log('\nQuick fix commands:');
  console.log('  git add -A                    # Stage all changes');
  console.log('  git commit -m "your message"  # Commit them');
  console.log('  git push                      # Push to deploy\n');
  process.exit(1);
} else {
  console.log('----------------------------------------');
  console.log(`${GREEN}Ready to deploy!${RESET}`);
  console.log('----------------------------------------');
  console.log('\nNext steps:');
  console.log('  git push                      # Deploy to Vercel\n');
  process.exit(0);
}
