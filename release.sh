#!/bin/bash
set -e

BRANCH_DEV="dev"
BRANCH_MAIN="main"

# Vérification branche
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "$BRANCH_DEV" ]; then
  echo "❌ Tu dois être sur '$BRANCH_DEV' pour lancer une release"
  exit 1
fi

# Choix version
echo "Type de release ?"
select RELEASE in patch minor major; do
  [[ -n "$RELEASE" ]] && break
done

# Vérifier working tree propre
if [[ -n $(git status --porcelain) ]]; then
  echo "❌ Working tree non propre. Commit ou stash avant."
  exit 1
fi

# Pull sécurité
git pull origin $BRANCH_DEV

# Bump version
npm version $RELEASE --no-git-tag-version

VERSION=$(node -p "require('./package.json').version")

echo "🚀 Release v$VERSION"

# Commit version
git commit -am "chore(release): v$VERSION"

# Merge vers main
git checkout $BRANCH_MAIN
git pull origin $BRANCH_MAIN
git merge --no-ff $BRANCH_DEV

# Tag
git tag v$VERSION

# Push
git push origin $BRANCH_MAIN
git push origin v$VERSION

# Retour sur dev
git checkout $BRANCH_DEV
git merge $BRANCH_MAIN
git push origin $BRANCH_DEV

echo "✅ Release v$VERSION terminée avec succès"

