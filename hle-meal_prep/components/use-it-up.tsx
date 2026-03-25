"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2, ChefHat, Clock, ExternalLink } from "lucide-react";
import { suggestRecipesForExpiringAction } from "@/app/(app)/dashboard/actions";
import type { UseItUpResult } from "@/app/(app)/dashboard/actions";

type ExpiringItem = {
  name: string;
  daysLeft: number;
};

export function UseItUp({
  expiringItems,
  mealieApiUrl,
}: {
  expiringItems: ExpiringItem[];
  mealieApiUrl: string | null;
}) {
  const [suggesting, startSuggest] = useTransition();
  const [result, setResult] = useState<UseItUpResult | null>(null);

  if (expiringItems.length === 0) return null;

  const handleSuggest = () => {
    const ingredients = expiringItems.map((i) => i.name);
    startSuggest(async () => {
      const res = await suggestRecipesForExpiringAction(ingredients);
      setResult(res);
    });
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Sparkles className="size-4 text-primary" />
          Use It Up
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-xs text-muted-foreground">
          {expiringItems.length} item{expiringItems.length !== 1 ? "s" : ""} expiring soon:
        </div>
        <div className="flex flex-wrap gap-1.5">
          {expiringItems.map((item) => (
            <Badge
              key={item.name}
              variant={item.daysLeft <= 1 ? "destructive" : "secondary"}
              className="text-[10px]"
            >
              {item.name}
              <span className="ml-1 opacity-70">
                {item.daysLeft <= 0 ? "expired" : `${item.daysLeft}d`}
              </span>
            </Badge>
          ))}
        </div>

        {!result && (
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={handleSuggest}
            disabled={suggesting}
          >
            {suggesting ? (
              <>
                <Loader2 className="size-3.5 mr-1.5 animate-spin" />
                Finding recipes...
              </>
            ) : (
              <>
                <ChefHat className="size-3.5 mr-1.5" />
                Suggest Recipes
              </>
            )}
          </Button>
        )}

        {result && "error" in result && (
          <p className="text-xs text-destructive">{result.error}</p>
        )}

        {result && "suggestions" in result && result.suggestions.length > 0 && (
          <div className="space-y-2 pt-1">
            {result.suggestions.slice(0, 4).map((s, i) => (
              <div key={i} className="rounded-md border p-2.5 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{s.recipeName}</span>
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <Clock className="size-3" />
                    {s.estimatedTime}
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground">{s.reasoning}</p>
                {s.missingIngredients.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-0.5">
                    <span className="text-[10px] text-muted-foreground">Need:</span>
                    {s.missingIngredients.slice(0, 3).map((ing) => (
                      <Badge key={ing} variant="outline" className="text-[9px] py-0">
                        {ing}
                      </Badge>
                    ))}
                    {s.missingIngredients.length > 3 && (
                      <span className="text-[10px] text-muted-foreground">
                        +{s.missingIngredients.length - 3} more
                      </span>
                    )}
                  </div>
                )}
                {s.mealieSlug && mealieApiUrl && (
                  <a
                    href={`${mealieApiUrl}/g/home/r/${s.mealieSlug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline pt-0.5"
                  >
                    View in Mealie <ExternalLink className="size-2.5" />
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
